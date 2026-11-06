import { describe, expect, it } from "vitest"

import { buildBookmarklet, parsePastedOverframe } from "./paste"

describe("parsePastedOverframe", () => {
  it("unwraps the bookmarklet payload", () => {
    const text = JSON.stringify({
      source: "arsenyx-overframe",
      url: "https://overframe.gg/build/1",
      nextData: { props: 1 },
    })
    expect(parsePastedOverframe(text)).toEqual({
      nextData: { props: 1 },
      url: "https://overframe.gg/build/1",
    })
  })

  it("accepts a bare __NEXT_DATA__ blob", () => {
    expect(parsePastedOverframe(' {"props":1} ')).toEqual({
      nextData: { props: 1 },
    })
  })

  it("rejects non-objects", () => {
    expect(() => parsePastedOverframe("42")).toThrow()
    expect(() => parsePastedOverframe("null")).toThrow()
  })

  it("reads back what the bookmarklet writes", () => {
    // The bookmarklet tags its payload with the same source the parser expects.
    expect(buildBookmarklet("https://x.test")).toContain(
      'source:"arsenyx-overframe"',
    )
  })
})
