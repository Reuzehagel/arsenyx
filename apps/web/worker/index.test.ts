import { describe, expect, it } from "vitest"

import worker, { buildPageCacheKeyUrl, isBrowserNavigation } from "./index"

describe("apex redirect", () => {
  const env = { ASSETS: { fetch: async () => new Response("") } }
  const ctx = { waitUntil() {} }
  const location = async (url: string) => {
    const res = await worker.fetch(new Request(url), env as never, ctx as never)
    return res.headers.get("location")
  }

  it("keeps the path and query on www", async () => {
    expect(await location("https://arsenyx.com/builds/x?y=1")).toBe(
      "https://www.arsenyx.com/builds/x?y=1",
    )
  })

  it("never redirects off-site for scheme-relative paths", async () => {
    for (const path of ["//evil.example/x", "/\\evil.example/x"]) {
      const loc = await location(`https://arsenyx.com${path}`)
      expect(new URL(loc!).origin).toBe("https://www.arsenyx.com")
    }
  })
})

describe("isBrowserNavigation", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://www.arsenyx.com/builds/x", { headers })
  const chrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

  it("fast-paths a real browser navigation", () => {
    expect(
      isBrowserNavigation(
        req({ "sec-fetch-dest": "document", "user-agent": chrome }),
      ),
    ).toBe(true)
  })

  it("keeps the enriched path for unfurlers without Sec-Fetch headers", () => {
    expect(
      isBrowserNavigation(
        req({ "user-agent": "Mozilla/5.0 (compatible; Discordbot/2.0)" }),
      ),
    ).toBe(false)
  })

  it("keeps the enriched path for Chrome-based crawlers that send Sec-Fetch", () => {
    expect(
      isBrowserNavigation(
        req({
          "sec-fetch-dest": "document",
          "user-agent": `${chrome} (compatible; Googlebot/2.1)`,
        }),
      ),
    ).toBe(false)
  })
})

// The worker itself is bundled by wrangler (not Vite) and lives outside the
// typecheck/lint graph, so this covers only the pure cache-key logic — the two
// invariants whose regression would be expensive: a deploy serving a stale
// asset shell (white screen), or one hot slug fragmenting across tracking-param
// variants. The actual cache hit/miss/store path needs a Workers runtime and is
// intentionally not exercised here.
describe("buildPageCacheKeyUrl", () => {
  const url = new URL("https://www.arsenyx.com/builds/wPDrEvV3Wf")

  it("namespaces the key by the deploy version so a deploy starts fresh", () => {
    const a = buildPageCacheKeyUrl(url, "v1")
    const b = buildPageCacheKeyUrl(url, "v2")
    expect(a).not.toBe(b)
    expect(a).toContain("__v=v1")
  })

  it("drops the query string so tracking params don't fragment the hot slug", () => {
    const tracked = new URL(
      "https://www.arsenyx.com/builds/wPDrEvV3Wf?utm_source=x&fbclid=y",
    )
    expect(buildPageCacheKeyUrl(tracked, "v1")).toBe(
      buildPageCacheKeyUrl(url, "v1"),
    )
  })

  it("falls back to a 'dev' namespace when no version is bound", () => {
    expect(buildPageCacheKeyUrl(url, undefined)).toContain("__v=dev")
  })

  it("URL-encodes the version so an odd id can't corrupt the key", () => {
    expect(buildPageCacheKeyUrl(url, "a b/c")).toContain("__v=a%20b%2Fc")
  })
})
