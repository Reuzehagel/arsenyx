import { Hono, type Context } from "hono"
import { describe, expect, it } from "vitest"

import { securityHeaders } from "./security"

function app(handler: (c: Context) => Response) {
  const a = new Hono()
  a.use("*", securityHeaders)
  a.get("/x", handler)
  return a
}

describe("securityHeaders", () => {
  it("hardens a normal JSON response", async () => {
    const res = await app((c) => c.json({ ok: true })).request("/x")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
    expect(res.headers.get("referrer-policy")).toBe("no-referrer")
  })

  it("leaves a route's own CSP alone", async () => {
    // /img must keep `sandbox` (and must NOT get frame-ancestors 'none'
    // clobbering it) — the middleware only fills in what's missing.
    const res = await app(
      () =>
        new Response("x", {
          headers: { "Content-Security-Policy": "default-src 'none'; sandbox" },
        }),
    ).request("/x")
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    )
  })

  it("does not throw on a response with immutable headers", async () => {
    // Cache API hits arrive this way. edge-cache.ts re-wraps them, but the
    // middleware must degrade rather than 500 if one ever slips through.
    const frozen = new Response("x")
    Object.defineProperty(frozen.headers, "set", {
      value: () => {
        throw new TypeError("immutable")
      },
    })
    const res = await app(() => frozen).request("/x")
    expect(res.status).toBe(200)
  })
})
