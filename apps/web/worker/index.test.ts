import { describe, expect, it } from "vitest"

import { buildPageCacheKeyUrl } from "./index"

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
