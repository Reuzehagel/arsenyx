import type { Context, MiddlewareHandler } from "hono"

// Best-effort edge caching for anonymous public reads, using the Cloudflare
// Cache API (`caches.default`). The point is purely to let Neon's autosuspend
// fire: every cache HIT is a request that never touches Postgres, so the DB
// can actually sleep during quiet periods instead of being kept awake by a
// constant trickle of reads. (Neon Free bills compute-hours and its 5-minute
// autosuspend is non-configurable, so "fewer wakeups" is the only lever.)
//
// Correctness invariant — we ONLY cache responses for requests with no session
// cookie. Authenticated detail/list responses are personalized (isOwner /
// hasLiked / hasBookmarked), so they must never enter the shared edge cache,
// and an authenticated viewer must never be served an anonymous cache entry.
// We detect the cookie by header rather than calling getSession() so this layer
// stays DB-free and fail-safe: a forged/garbage token just bypasses the cache.

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
export function purgeEdge(c: Context, path: string): void {
  const cache = defaultCache()
  if (!cache) return
  const url = new URL(c.req.url)
  url.pathname = path
  url.search = ""
  runInBackground(
    c,
    cache.delete(new Request(url.toString(), { method: "GET" })),
  )
}
