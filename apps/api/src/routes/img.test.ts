import { afterEach, describe, expect, it, vi } from "vitest"

import { img } from "./img"

// The image proxy's content-type gate is a security control, not a nicety: it
// is the only thing stopping `api.arsenyx.com/img?u=…` from serving an
// attacker-controlled SVG — a scriptable document — from the origin that holds
// the session cookies. These tests pin that behaviour.

// safeFetch resolves the host over DoH before fetching (blockPrivateDns), so
// the stub has to answer both the 1.1.1.1 lookup and the image request.
function stubUpstream(contentType: string, body = "binary-ish") {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    if (url.includes("1.1.1.1/dns-query")) {
      // No A/AAAA answers → treated as not-private, request proceeds.
      return new Response(JSON.stringify({ Answer: [] }), {
        headers: { "content-type": "application/dns-json" },
      })
    }
    return new Response(body, { headers: { "content-type": contentType } })
  })
}

function get(u = "https://cdn.example.com/a.svg") {
  return img.request(`/?u=${encodeURIComponent(u)}`)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("GET /img content-type gate", () => {
  it("rejects image/svg+xml — an SVG loaded as a top-level document runs script on our origin", async () => {
    stubUpstream("image/svg+xml")
    const res = await get()
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ error: "not_image" })
  })

  it("rejects SVG even with a charset parameter appended", async () => {
    // The naive `startsWith("image/")` check passed this; so would an exact
    // string compare against the full header value.
    stubUpstream("image/svg+xml; charset=utf-8")
    expect((await get()).status).toBe(415)
  })

  it("rejects a non-image type outright", async () => {
    stubUpstream("text/html")
    expect((await get()).status).toBe(415)
  })

  it("rejects a comma-joined type that reads as an image but resolves as HTML", async () => {
    // Stripping parameters leaves `image/png, text/html`, which passes a
    // startsWith check as one token — but a browser's MIME extraction takes
    // the LAST type in the list.
    stubUpstream("image/png, text/html")
    expect((await get()).status).toBe(415)
  })

  it("serves a real image, neutralised as a document", async () => {
    // Parameters are dropped on the way out: only the normalised type is
    // echoed, never the upstream string.
    stubUpstream("image/png; charset=binary")
    const res = await get("https://cdn.example.com/a.png")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    // Defence in depth behind the type gate above.
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    )
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })
})
