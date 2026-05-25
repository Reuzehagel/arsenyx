import type { MiddlewareHandler } from "hono"

import type { Bindings } from "../bindings"
import { prisma, registerBackgroundWork } from "../db"
import {
  PRUNE_MAX_AGE_MS,
  PRUNE_PROBABILITY,
  currentWindowStart,
  secondsUntilNextMinute,
} from "../lib/rate-window"
import { getSession } from "../lib/session"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Per-bucket per-minute caps for cookie-session mutations. Tuned generously —
// the goal is abuse throttling, not policing normal use.
//
// "social" covers cheap toggles (likes, bookmarks, view-count).
// "mutate" covers the heavier writes (build create/update/delete, org admin).
// "import" covers external-fetch mutations (Overframe scrape).
// "search" covers expensive read endpoints (typeahead, full-text scans) and
//   IS applied to GET requests — anon traffic still slips through (no session
//   to key on) and is expected to be throttled at the Cloudflare edge.
export const RATE_LIMITS = {
  social: 60,
  mutate: 20,
  import: 10,
  search: 60,
} as const

export type RateLimitBucket = keyof typeof RATE_LIMITS

export type RateLimitOptions = {
  // Set true for read endpoints whose work is expensive enough to warrant a
  // per-user cap on GETs as well as writes.
  includeSafeMethods?: boolean
}

// Best-effort rate limiter for session-cookie routes. Same semantics as the
// PAT limiter in api-key-auth.ts: the upsert is racy across Workers isolates
// so short bursts can exceed the cap before any isolate observes it. Fine for
// abuse throttling.
export function rateLimitUser(
  bucket: RateLimitBucket,
  opts: RateLimitOptions = {},
): MiddlewareHandler {
  const limit = RATE_LIMITS[bucket]
  const skipSafe = !opts.includeSafeMethods
  return async (c, next) => {
    if (skipSafe && SAFE_METHODS.has(c.req.method)) return next()

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

    if (Math.random() < PRUNE_PROBABILITY) {
      registerBackgroundWork(
        prisma.userRateLimitWindow.deleteMany({
          where: {
            windowStart: { lt: new Date(Date.now() - PRUNE_MAX_AGE_MS) },
          },
        }),
      )
    }

    await next()
  }
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
//
// Fail-open if the binding is missing outside production (local `wrangler dev`
// usually has it, but a stripped wrangler.toml shouldn't break dev/tests).
// Fail-loudly in production via a server log.
export function rateLimitAnonRead(): MiddlewareHandler {
  return async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) return next()

    const limiter = (c.env as Bindings | undefined)?.ANON_READ_LIMITER
    if (!limiter) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "rate-limit: ANON_READ_LIMITER binding missing in production",
        )
      }
      return next()
    }

    // Authenticated → key by user id so household/office NATs don't collide.
    // Anon (including forged cookies, which fail to decode) → key by IP.
    const session = await getSession(c)
    const key = session?.user
      ? `u:${session.user.id}`
      : `ip:${c.req.header("cf-connecting-ip") ?? "unknown"}`
    if (!session?.user && !c.req.header("cf-connecting-ip")) {
      console.warn("rate-limit: missing cf-connecting-ip header")
    }

    const { success } = await limiter.limit({ key })
    if (!success) return c.json({ error: "rate_limited" }, 429)

    await next()
  }
}
