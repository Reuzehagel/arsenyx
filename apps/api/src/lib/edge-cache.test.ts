import { Hono } from "hono"
import { setCookie } from "hono/cookie"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { edgeCache, purgeEdge } from "./edge-cache"

// Map-backed stand-in for `caches.default`. The real Cloudflare Cache API isn't
// present under vitest's node environment, so without this the middleware's
// `defaultCache()` returns null and every request falls through uncached —
// which would make these tests assert nothing. Keyed by request URL (the
// middleware already normalizes query-param order via cacheKey()).
class FakeCache {
  store = new Map<string, Response>()
  match(req: Request): Promise<Response | undefined> {
    const hit = this.store.get(req.url)
    // Clone on read: a Response body is a one-shot stream, and the same entry
    // may be served to multiple hits.
    return Promise.resolve(hit ? hit.clone() : undefined)
  }
  put(req: Request, res: Response): Promise<void> {
    this.store.set(req.url, res)
    return Promise.resolve()
  }
  delete(req: Request): Promise<boolean> {
    return Promise.resolve(this.store.delete(req.url))
  }
}

let fake: FakeCache

beforeEach(() => {
  fake = new FakeCache()
  ;(globalThis as unknown as { caches: unknown }).caches = { default: fake }
})

afterEach(() => {
  delete (globalThis as unknown as { caches?: unknown }).caches
})

// Drive a request through app.fetch with a real ExecutionContext so the
// middleware's waitUntil-backed cache.put() (runInBackground) is captured and
// awaited — otherwise the store would race the assertions.
async function run(
  app: Hono,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const waits: Promise<unknown>[] = []
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      waits.push(p)
    },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext
  const res = await app.fetch(new Request(url, init), {}, ctx)
  await Promise.all(waits)
  return res
}

const AUTHED = { headers: { Cookie: "better-auth.session_token=abc" } }
const BASE = "http://api.test/builds/x/partners"

describe("edgeCache", () => {
  it("serves a second anonymous request from cache without re-running the handler", async () => {
    let calls = 0
    const app = new Hono()
    app.get("*", edgeCache({ maxAge: 300 }), (c) => {
      calls++
      return c.json({ n: calls })
    })

    const first = await run(app, BASE)
    expect(await first.json()).toEqual({ n: 1 })

    const second = await run(app, BASE)
    // Handler did NOT run again; the cached body is replayed verbatim.
    expect(calls).toBe(1)
    expect(await second.json()).toEqual({ n: 1 })
  })

  it("bypasses the cache entirely for requests carrying a session cookie", async () => {
    let calls = 0
    const app = new Hono()
    app.get("*", edgeCache({ maxAge: 300 }), (c) => {
      calls++
      return c.json({ n: calls })
    })

    await run(app, BASE, AUTHED)
    await run(app, BASE, AUTHED)
    // Personalized responses must never be cached or served from cache.
    expect(calls).toBe(2)
    expect(fake.store.size).toBe(0)
  })

  it("never serves an anonymous cache entry to an authenticated request", async () => {
    let calls = 0
    const app = new Hono()
    app.get("*", edgeCache({ maxAge: 300 }), (c) => {
      calls++
      return c.json({ who: calls === 1 ? "anon" : "authed" })
    })

    await run(app, BASE) // anon populates the cache
    const authed = await run(app, BASE, AUTHED)
    // The authed request runs the handler instead of replaying the anon body.
    expect(calls).toBe(2)
    expect(await authed.json()).toEqual({ who: "authed" })
  })

  it("strips Set-Cookie and stamps Cache-Control + Vary on the stored entry", async () => {
    const app = new Hono()
    app.get("*", edgeCache({ maxAge: 300 }), (c) => {
      // A per-viewer cookie (e.g. the view-dedupe cookie) must not be shared
      // across viewers via the cache.
      setCookie(c, "vw_x", "1")
      return c.json({ ok: true })
    })

    await run(app, BASE) // miss: stores a cleaned clone
    const hit = await run(app, BASE) // hit: returns the stored clone
    expect(hit.headers.get("Set-Cookie")).toBeNull()
    expect(hit.headers.get("Cache-Control")).toBe("public, max-age=300")
    expect(hit.headers.get("Vary")).toBe("Cookie")
  })

  it("does not cache non-200 responses", async () => {
    let calls = 0
    const app = new Hono()
    app.get("*", edgeCache({ maxAge: 300 }), (c) => {
      calls++
      return c.json({ error: "not_found" }, 404)
    })

    await run(app, BASE)
    await run(app, BASE)
    expect(calls).toBe(2)
    expect(fake.store.size).toBe(0)
  })

  it("normalizes query-param order to a single cache entry", async () => {
    let calls = 0
    const app = new Hono()
    app.get("*", edgeCache({ maxAge: 300 }), (c) => {
      calls++
      return c.json({ n: calls })
    })

    await run(app, `${BASE}?a=1&b=2`)
    const reordered = await run(app, `${BASE}?b=2&a=1`)
    expect(calls).toBe(1)
    expect(await reordered.json()).toEqual({ n: 1 })
  })

  it("purgeEdge evicts the detail path and its embed/view variants", async () => {
    let calls = 0
    const app = new Hono()
    app.get("/builds/:slug", edgeCache({ maxAge: 300 }), (c) => {
      calls++
      return c.json({ n: calls })
    })
    // Mounted so purgeEdge (which mutates the request URL's pathname) can run
    // against a real context.
    app.get("/purge/:slug", (c) => {
      purgeEdge(c, `/builds/${c.req.param("slug")}`)
      return c.body(null, 204)
    })

    await run(app, "http://api.test/builds/x") // populate
    await run(app, "http://api.test/builds/x") // hit
    expect(calls).toBe(1)

    await run(app, "http://api.test/purge/x")
    await run(app, "http://api.test/builds/x") // miss again post-purge
    expect(calls).toBe(2)
  })
})
