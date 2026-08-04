import type { Context, MiddlewareHandler } from "hono"

import { getSession } from "./session"

// Best-effort edge caching for anonymous public reads, using the Cloudflare
// Cache API (`caches.default`). Every cache HIT is a request that never touches
// Postgres (nor Hyperdrive).
//
// This originally existed to stay under the Hyperdrive Free-plan daily query
// cap. That cap no longer applies (Workers Paid bills no Hyperdrive queries),
// so the reasons to keep it are now: (a) PlanetScale compute — Hyperdrive is
// just the pool, every miss is still a real Postgres query; (b) latency — a
// colo hit skips the DB round-trip for anonymous browsing and Discord/embed
// traffic, which is most of the load. Both are quality/cost wins rather than a
// hard ceiling, so TTLs here can be tuned down freely if freshness matters more.
//
// Correctness invariant — we ONLY cache responses for requests with no VALID
// session. Authenticated detail/list responses are personalized (isOwner /
// hasLiked / hasBookmarked), so they must never enter the shared edge cache,
// and an authenticated viewer must never be served an anonymous cache entry.
//
// This deliberately resolves the real session rather than sniffing the Cookie
// header for a marker substring. A header check is trivially spoofable: any
// request carrying `Cookie: session_token=x` would skip the cache and fall
// through to Postgres, so an attacker could force a 100% miss rate on every
// public read and turn the edge cache — our main shield on PlanetScale compute
// — into a no-op. Verifying instead means a forged/garbage token resolves to no
// user and is served from cache like any other anonymous request.
//
// Cost is nil in practice: getSession() is memoized per request (lib/session.ts)
// and rateLimitAnonRead already resolved it upstream for every edge-cached
// route, so this is a map read. Requests with no Cookie header at all skip it
// entirely.
async function isAuthenticated(c: Context): Promise<boolean> {
  if (c.req.header("Cookie") == null) return false
  try {
    const session = await getSession(c)
    return session?.user != null
  } catch {
    // Fail CLOSED. The old header check couldn't throw; this one can (session
    // lookup may hit the DB on a cookie-cache miss). If we can't determine who
    // the caller is, assume authenticated and skip the cache — worst case is a
    // missed cache hit, whereas failing open could serve a personalized page
    // from the shared anonymous entry, or store one into it.
    return true
  }
}

// `caches` is a Workers global and may be absent in some test/runtime contexts.
// Guard at runtime so the API still works (just uncached) wherever the Cache
// API isn't available.
function defaultCache(): Cache | null {
  if (typeof caches === "undefined") return null
  // `caches.default` is a Cloudflare Workers extension not present on the DOM
  // lib's CacheStorage type.
  return (caches as unknown as { default: Cache }).default
}

// Normalize the cache key: same origin + path, query params sorted so
// `?a=1&b=2` and `?b=2&a=1` resolve to a single entry. Cookies are excluded by
// construction (a bare Request from the URL).
function cacheKey(url: URL): Request {
  url.searchParams.sort()
  return new Request(url.toString(), { method: "GET" })
}

function runInBackground(c: Context, p: Promise<unknown>): void {
  try {
    c.executionCtx.waitUntil(p)
  } catch {
    // No executionCtx (e.g. unit tests via app.request()) — swallow so a
    // missing background context never surfaces as a request error.
    void p.catch(() => {})
  }
}

// Cache anonymous 200 GET responses at the edge for `maxAge` seconds. Apply as
// route middleware on public read endpoints only.
export function edgeCache(opts: { maxAge: number }): MiddlewareHandler {
  return async (c, next) => {
    const cache = defaultCache()
    if (c.req.method !== "GET" || !cache || (await isAuthenticated(c))) {
      return next()
    }

    const key = cacheKey(new URL(c.req.url))
    const hit = await cache.match(key)
    if (hit) return hit

    await next()

    const res = c.res
    if (res.status !== 200) return

    // Store a clone with a short TTL. Set-Cookie must go: Cloudflare's
    // cache.put() rejects responses carrying one, and it would otherwise share
    // the per-build view-dedupe cookie across every viewer.
    const cloned = res.clone()
    const headers = new Headers(cloned.headers)
    headers.delete("Set-Cookie")
    headers.set("Cache-Control", `public, max-age=${opts.maxAge}`)
    // Vary on Cookie so the BROWSER (and any shared intermediary) never reuses
    // this anonymous body for an authenticated request. Without it, a viewer who
    // loads a build logged-out then logs in could be served the cached anonymous
    // payload from their own HTTP cache for up to max-age — hiding their
    // owner/like/bookmark state. Cloudflare's own Cache API ignores Vary at
    // match() time (it only varies on Range/If-Modified-Since/If-None-Match), so
    // this does NOT affect our edge hits: we key off a cookieless Request, so the
    // edge keeps matching regardless. cache.put only rejects `Vary: *`.
    headers.set("Vary", "Cookie")
    const stored = new Response(cloned.body, {
      status: cloned.status,
      statusText: cloned.statusText,
      headers,
    })
    runInBackground(c, cache.put(key, stored))
  }
}

// Best-effort eviction of a cached path. Cache API deletes are colo-local, so
// this only evicts where the mutating request landed; other colos expire via
// the short TTL above. Authenticated editors bypass the cache entirely, so they
// always see their own writes immediately regardless of this.
//
// Scope note: callers purge the build DETAIL path only. The `GET /builds` LIST
// (and the `/:slug/partners` strip) are also edge-cached (maxAge 10s) but are
// NOT purged here — their entries are keyed by every filter/sort/page param
// combination, and the Cache API has no wildcard delete, so there's no
// tractable key to evict. Consequence: when a build flips PUBLIC->PRIVATE or is
// deleted, its title/summary can linger in cached listings for up to that 10s
// TTL. Accepted as a bounded, best-effort window (the detail payload — the
// sensitive surface — is purged precisely).
export function purgeEdge(c: Context, path: string): void {
  const cache = defaultCache()
  if (!cache) return
  const base = new URL(c.req.url)
  base.pathname = path
  // The detail route caches three separate entries under distinct keys: the
  // bare path (full payload), `?embed=1` (slim link-unfurl payload for anonymous
  // scrapers), and `?view=0` (full payload for the embed viewer — same body,
  // browser-cacheable, no view bump). Evict all three, or a build set
  // PRIVATE/deleted keeps leaking its name/description/loadout through whichever
  // variant is missed until TTL expiry.
  for (const search of ["", "?embed=1", "?view=0"]) {
    const url = new URL(base.toString())
    url.search = search
    // Build the delete key through the same cacheKey() the store path uses, so
    // param normalization (searchParams.sort()) can never drift between the two
    // and leave an un-evicted entry.
    runInBackground(c, cache.delete(cacheKey(url)))
  }
}
