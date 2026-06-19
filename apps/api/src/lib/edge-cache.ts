import type { Context, MiddlewareHandler } from "hono"

// Best-effort edge caching for anonymous public reads, using the Cloudflare
// Cache API (`caches.default`). Every cache HIT is a request that never touches
// Postgres (nor Hyperdrive), so this directly cuts query volume against the
// Hyperdrive Free-plan daily query cap — the dominant lever now that anonymous
// reads (site browsing + Discord/embed traffic) make up most of the load.
//
// Correctness invariant — we ONLY cache responses for requests with no session
// cookie. Authenticated detail/list responses are personalized (isOwner /
// hasLiked / hasBookmarked), so they must never enter the shared edge cache,
// and an authenticated viewer must never be served an anonymous cache entry.
// We detect the cookie by header rather than calling getSession() so this layer
// stays DB-free and fail-safe: a forged/garbage token just bypasses the cache.

// Substring matched against the Cookie header to detect an authenticated
// request. This pins on Better Auth's default cookie name containing
// `session_token` (e.g. `better-auth.session_token`). If the Better Auth
// `cookiePrefix`/cookie name is ever customised to something without this
// substring, anonymous-only caching silently breaks the WRONG way — it would
// start caching authenticated responses — so keep this marker in sync with the
// auth config (auth.ts).
const SESSION_COOKIE_MARKER = "session_token"

function hasSessionCookie(c: Context): boolean {
  const cookie = c.req.header("Cookie")
  return cookie != null && cookie.includes(SESSION_COOKIE_MARKER)
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
    if (c.req.method !== "GET" || hasSessionCookie(c) || !cache) {
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
// (and the `/:slug/partners` strip) are also edge-cached (maxAge 300s) but are
// NOT purged here — their entries are keyed by every filter/sort/page param
// combination, and the Cache API has no wildcard delete, so there's no
// tractable key to evict. Consequence: when a build flips PUBLIC->PRIVATE or is
// deleted, its title/summary can linger in cached listings for up to that 300s
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
