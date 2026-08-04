import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { rateLimitAuth } from "./rate-limit"

// Stand-in for the Workers Rate Limiting binding declared in wrangler.toml.
function fakeLimiter(success: boolean) {
  return { limit: vi.fn(async () => ({ success })) }
}

// Mirrors the registration in src/index.ts: the limiter is declared BEFORE the
// /auth/* handler. Hono only runs middleware registered ahead of the route it
// matches, so wiring it after would silently no-op — which is exactly the
// regression this file exists to catch.
function authApp() {
  const app = new Hono()
  app.use("/auth/*", rateLimitAuth())
  app.all("/auth/*", (c) => c.json({ ok: true }))
  return app
}

const IP = { headers: { "cf-connecting-ip": "203.0.113.7" } }

describe("rateLimitAuth", () => {
  it("passes the request through when under the cap", async () => {
    const limiter = fakeLimiter(true)
    const res = await authApp().fetch(
      new Request("http://api.test/auth/get-session", IP),
      { AUTH_LIMITER: limiter },
    )
    expect(res.status).toBe(200)
    expect(limiter.limit).toHaveBeenCalledWith({ key: "ip:203.0.113.7" })
  })

  it("returns 429 once the cap is exceeded", async () => {
    const res = await authApp().fetch(
      new Request("http://api.test/auth/get-session", IP),
      { AUTH_LIMITER: fakeLimiter(false) },
    )
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: "rate_limited" })
  })

  it("covers non-GET methods", async () => {
    // Unlike the anon-read limiter this must throttle POSTs — sign-in,
    // sign-out and update-user are the sensitive endpoints here.
    const res = await authApp().fetch(
      new Request("http://api.test/auth/sign-in/social", {
        method: "POST",
        ...IP,
      }),
      { AUTH_LIMITER: fakeLimiter(false) },
    )
    expect(res.status).toBe(429)
  })

  it("runs on the OAuth callback path", async () => {
    const limiter = fakeLimiter(true)
    await authApp().fetch(
      new Request("http://api.test/auth/callback/github?code=x", IP),
      { AUTH_LIMITER: limiter },
    )
    expect(limiter.limit).toHaveBeenCalledOnce()
  })

  it("buckets callers missing cf-connecting-ip under a shared key", async () => {
    const limiter = fakeLimiter(true)
    await authApp().fetch(new Request("http://api.test/auth/get-session"), {
      AUTH_LIMITER: limiter,
    })
    expect(limiter.limit).toHaveBeenCalledWith({ key: "ip:unknown" })
  })

  it("fails open outside production when the binding is missing", async () => {
    // A stripped wrangler.toml (dev/tests) must not break auth entirely.
    const res = await authApp().fetch(
      new Request("http://api.test/auth/get-session", IP),
      {},
    )
    expect(res.status).toBe(200)
  })
})
