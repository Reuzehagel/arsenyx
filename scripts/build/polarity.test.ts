import { describe, expect, it } from "bun:test"

import { normalizePolarity, POLARITY_SET } from "./polarity"

describe("normalizePolarity", () => {
  it("lowercases recognized polarities", () => {
    expect(normalizePolarity("Madurai")).toBe("madurai")
    expect(normalizePolarity("NARAMON")).toBe("naramon")
    expect(normalizePolarity("Zenurik")).toBe("zenurik")
  })

  it("maps the wiki 'None' sentinel and empty/non-string values to null", () => {
    expect(normalizePolarity("None")).toBeNull()
    expect(normalizePolarity("none")).toBeNull()
    expect(normalizePolarity("")).toBeNull()
    expect(normalizePolarity(undefined)).toBeNull()
    expect(normalizePolarity(42)).toBeNull()
  })

  it("passes an unrecognized polarity through verbatim (never drops/throws)", () => {
    expect(normalizePolarity("Mystery")).toBe("mystery")
  })

  it("POLARITY_SET holds canonical names but not the 'none' sentinel", () => {
    expect(POLARITY_SET.has("madurai")).toBe(true)
    expect(POLARITY_SET.has("none")).toBe(false)
  })
})
