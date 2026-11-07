import type { Context, MiddlewareHandler } from "hono"

import type { Bindings } from "../bindings"
import { prisma, sometimesInBackground } from "../db"
import { getSession } from "../lib/session"
import { isSafeMethod } from "./security"

/** Fraction of requests that opportunistically prune expired windows. */
const PRUNE_PROBABILITY = 0.01
const PRUNE_MAX_AGE_MS = 10 * 60_000

/** Start of the current 1-minute window, used as the upsert key. */
const currentWindowStart = (now = Date.now()) =>
  new Date(Math.floor(now / 60_000) * 60_000)

/** Seconds until the current window rolls over (for Retry-After / Reset). */
const secondsUntilNextMinute = (now = Date.now()) =>
  Math.max(1, 60 - Math.floor((now / 1000) % 60))

/** The caller's IP as Cloudflare's edge reports it (`cf-connecting-ip`
 *  overwrites any client-supplied value). Without it every caller shares the
 *  literal key "unknown" — a fail-closed bucket that trips fast, preferable to
 *  failing open, but logged so it's diagnosable. */
function clientIp(c: Context): string {
  const ip = c.req.header("cf-connecting-ip")
  if (!ip) console.warn("rate-limit: missing cf-connecting-ip header")
  return ip ?? "unknown"
}

// Per-bucket per-minute caps for cookie-session mutations. Tuned generously —
// the goal is abuse throttling, not policing normal use.
//
// "social" covers cheap toggles (likes, dislikes, bookmarks).
// "mutate" covers the heavier writes (build create/update/delete, org admin).
// "import" covers the Overframe paste import (a 1.5 MB __NEXT_DATA__ parse).
// "search" covers expensive read endpoints (typeahead, full-text scans) and
//   IS applied to GET requests — anon traffic still slips through (no session
//   to key on) and is expected to be throttled at the Cloudflare edge.
const RATE_LIMITS = {
  social: 60,
  mutate: 20,
  import: 10,
  search: 60,
} as const

type RateLimitBucket = keyof typeof RATE_LIMITS

type RateLimitOptions = {
  // Set true for read endpoints whose work is expensive enough to warrant a
  // per-user cap on GETs as well as writes.
  includeSafeMethods?: boolean
}

// Best-effort rate limiter for session-cookie routes: the upsert is racy
// across Workers isolates so short bursts can exceed the cap before any isolate
// observes it. Fine for abuse throttling.
export function rateLimitUser(
  bucket: RateLimitBucket,
  opts: RateLimitOptions = {},
): MiddlewareHandler {
  const limit = RATE_LIMITS[bucket]
  const skipSafe = !opts.includeSafeMethods
  return async (c, next) => {
    if (skipSafe && isSafeMethod(c)) return next()

    const session = await getSession(c)
    if (!session?.user) return next() // Let downstream handler return 401.
    const userId = session.user.id

    const windowStart = currentWindowStart()
    const window = await prisma.userRateLimitWindow.upsert({
      where: {
        userId_bucket_windowStart: { userId, bucket, windowStart },
      },
      create: { userId, bucket, windowStart, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
      select: { requestCount: true },
    })

    const used = window.requestCount
    const resetSeconds = secondsUntilNextMinute()

    c.header("X-RateLimit-Limit", String(limit))
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - used)))
    c.header("X-RateLimit-Reset", String(resetSeconds))

    if (used > limit) {
      c.header("Retry-After", String(resetSeconds))
      return c.json({ error: "rate_limited" }, 429)
    }

    sometimesInBackground(PRUNE_PROBABILITY, "rate-limit prune", () =>
      prisma.userRateLimitWindow.deleteMany({
        where: {
          windowStart: { lt: new Date(Date.now() - PRUNE_MAX_AGE_MS) },
        },
      }),
    )

    await next()
  }
}

// Shared edge rate-limit policy for the Workers Rate Limiting API bindings
// (ANON_SEARCH_LIMITER / ANON_READ_LIMITER). Returns a 429 `Response` when the
// key is throttled, or `null` to let the caller proceed.
//
// Fail-open if the binding is missing outside production (local `wrangler dev`
// usually has it, but a stripped wrangler.toml shouldn't break dev/tests).
// Fail-loudly in production via a server log naming the binding and, when
// given, the route that went unthrottled — the binding is anon's only defence
// in prod, so the log is an operational alarm. `keyFn` is only invoked when
// the binding is present, so callers can defer work (e.g. a session lookup)
// that's pointless when the limiter is absent.
async function enforceAnonEdgeLimit(
  c: Context,
  bindingName: "ANON_SEARCH_LIMITER" | "ANON_READ_LIMITER" | "AUTH_LIMITER",
  keyFn: () => string | Promise<string>,
  routeLabel?: string,
): Promise<Response | null> {
  const limiter = (c.env as Bindings | undefined)?.[bindingName]
  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `rate-limit: ${bindingName} binding missing in production` +
          (routeLabel ? ` — anon ${routeLabel} is unthrottled` : ""),
      )
    }
    return null
  }
  const { success } = await limiter.limit({ key: await keyFn() })
  if (!success) return c.json({ error: "rate_limited" }, 429)
  return null
}

// Edge-side throttle for the anonymous half of a search/typeahead endpoint.
// Signed-in callers short-circuit (they're bound by rateLimitUser on mutations
// and by ANON_READ_LIMITER's user-keyed bucket on reads); anon callers are
// keyed by IP on the tighter ANON_SEARCH_LIMITER bucket.
//
// Call this from the handler rather than as middleware: these routes only want
// the search bucket when a query is actually present, so a plain paginated read
// of the same path isn't charged against it. `routeLabel` names the route in
// the production "binding missing" log.
export async function enforceAnonSearchLimit(
  c: Context,
  routeLabel: string,
): Promise<Response | null> {
  const session = await getSession(c)
  if (session?.user) return null

  return enforceAnonEdgeLimit(
    c,
    "ANON_SEARCH_LIMITER",
    () => clientIp(c),
    routeLabel,
  )
}

// Edge-side read limiter for public GET endpoints. Throttles unauthenticated
// browsing/scraping; authenticated traffic is keyed by user.id instead, so
// shared NAT / household IPs don't collide on the same bucket.
//
// `getSession` uses Better Auth's signed cookie cache: a request with a valid
// session token usually returns from the cache cookie (no DB roundtrip).
// Crucially, a forged `better-auth.session_token` cookie won't decode, so
// it falls through to the IP-keyed branch — closing the spoof bypass that an
// unvalidated cookie-presence check would leave open.
export function rateLimitAnonRead(): MiddlewareHandler {
  return async (c, next) => {
    if (!isSafeMethod(c)) return next()

    const blocked = await enforceAnonEdgeLimit(
      c,
      "ANON_READ_LIMITER",
      async () => {
        // Authenticated → key by user id so household/office NATs don't
        // collide. Anon (including forged cookies, which fail to decode) →
        // key by IP.
        const session = await getSession(c)
        return session?.user ? `u:${session.user.id}` : `ip:${clientIp(c)}`
      },
    )
    if (blocked) return blocked

    await next()
  }
}

// Edge-side throttle for the Better Auth surface (/auth/*). Better Auth ships
// its own limiter and it's active in production — advanced.ipAddress points it
// at `cf-connecting-ip` so it can actually identify callers (see auth.ts) — but
// its default storage is in-memory. On Workers that's one counter per isolate,
// so the real ceiling scales with however many isolates Cloudflare spins up.
// This binding is enforced centrally and is what actually holds under load.
//
// Unlike rateLimitAnonRead this covers ALL methods: the sensitive endpoints
// here are POSTs (sign-in, sign-out, update-user) and the OAuth callback, which
// writes to Postgres. Keyed by IP only — resolving a session first would be
// circular on the very endpoints that establish one, and pointless on the rest.
export function rateLimitAuth(): MiddlewareHandler {
  return async (c, next) => {
    const blocked = await enforceAnonEdgeLimit(
      c,
      "AUTH_LIMITER",
      () => `ip:${clientIp(c)}`,
    )
    if (blocked) return blocked

    await next()
  }
}
