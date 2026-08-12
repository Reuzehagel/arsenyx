import { describe, expect, it } from "vitest"

import { webOrigins } from "./env"
import app from "./index"

// End-to-end over the real middleware stack in src/index.ts. The unit test in
// middleware/security-headers.test.ts covers the header logic; this one exists
// to catch a *wiring* regression — securityHeaders must sit outermost, and it
// must not disturb the CORS preflight that every browser mutation depends on.

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext

const fetchApp = (req: Request) => app.fetch(req, {}, ctx)

describe("app security wiring", () => {
  it("hardens responses that never touch a route guard", async () => {
    const res = await fetchApp(new Request("http://api.test/health"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("leaves the credentialed CORS preflight intact", async () => {
    const origin = webOrigins[0]
    const res = await fetchApp(
      new Request("http://api.test/builds", {
        method: "OPTIONS",
        headers: {
          origin,
          "access-control-request-method": "POST",
        },
      }),
    )
    expect(res.status).toBeLessThan(300)
    expect(res.headers.get("access-control-allow-origin")).toBe(origin)
    expect(res.headers.get("access-control-allow-credentials")).toBe("true")
  })

  it("rejects a cross-origin mutation before it reaches a handler", async () => {
    const res = await fetchApp(
      new Request("http://api.test/builds/abc", {
        method: "DELETE",
        headers: { origin: "https://evil.example" },
      }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "forbidden_origin" })
  })

  // The user directory is mounted on the router *root* (`GET /users`), so it
  // is the one public route whose path has no segment after the mount point.
  // `app.use("/users/*", …)` still covers it in Hono — this pins that, because
  // if it ever stopped matching, the directory would silently escape
  // originGuard, banGuard, and the anon read limiter with no other symptom.
  it("applies the /users/* guards to the bare /users path", async () => {
    const res = await fetchApp(
      new Request("http://api.test/users", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "forbidden_origin" })
  })
})
