import { describe, expect, it } from "vitest"

import {
  BROWSE_CATEGORY_IDS,
  CATEGORY_LABELS,
  getCategoryLabel,
  isValidCategory,
} from "./categories"

describe("isValidCategory", () => {
  it("accepts every real category id", () => {
    for (const id of BROWSE_CATEGORY_IDS) {
      expect(isValidCategory(id)).toBe(true)
    }
  })

  it("rejects unknown values and Object.prototype keys", () => {
    // The Set backing rejects prototype members that a plain-object `in` /
    // index lookup would accept — guarding the worker's route matching and the
    // label lookup from `?category=constructor`-style junk.
    for (const junk of [
      "",
      "all",
      "frames",
      "constructor",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "__proto__",
    ]) {
      expect(isValidCategory(junk)).toBe(false)
    }
  })
})

describe("getCategoryLabel", () => {
  it("labels every real category", () => {
    for (const id of BROWSE_CATEGORY_IDS) {
      expect(getCategoryLabel(id)).toBe(CATEGORY_LABELS[id])
    }
  })

  it("echoes unknown ids unchanged, including prototype keys", () => {
    expect(getCategoryLabel("mystery")).toBe("mystery")
    // Would return the inherited `Object` constructor with a bare index lookup.
    expect(getCategoryLabel("constructor")).toBe("constructor")
    expect(getCategoryLabel("toString")).toBe("toString")
  })
})

describe("category single source", () => {
  it("derives the id list from the label record, so they can't drift", () => {
    expect([...BROWSE_CATEGORY_IDS].sort()).toEqual(
      Object.keys(CATEGORY_LABELS).sort(),
    )
  })
})
