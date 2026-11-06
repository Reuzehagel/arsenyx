import { MAX_TOTAL_VARIANTS } from "@arsenyx/shared/warframe/build-data"
import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"
import { describe, expect, it } from "vitest"

import { asVariantMap, isVariantIndex } from "./_build-partners"

describe("partner variant index", () => {
  // MAX_VARIANTS is a per-form cap: a twin-frame's second form starts at index
  // MAX_VARIANTS, so a link to it must be storable.
  it("accepts a twin-frame's second-form variant", () => {
    expect(isVariantIndex(MAX_VARIANTS)).toBe(true)
    expect(asVariantMap({ p1: MAX_VARIANTS + 1 })).toEqual({
      p1: MAX_VARIANTS + 1,
    })
  })

  it("rejects indexes past the whole document's cap, and non-integers", () => {
    expect(isVariantIndex(MAX_TOTAL_VARIANTS)).toBe(false)
    expect(isVariantIndex(-1)).toBe(false)
    expect(isVariantIndex(1.5)).toBe(false)
    expect(isVariantIndex("2")).toBe(false)
  })

  it("drops the default (0) and garbage when reading the stored map", () => {
    expect(asVariantMap({ a: 0, b: 2, c: "3", d: MAX_TOTAL_VARIANTS })).toEqual(
      { b: 2 },
    )
    expect(asVariantMap([1, 2])).toEqual({})
  })
})
