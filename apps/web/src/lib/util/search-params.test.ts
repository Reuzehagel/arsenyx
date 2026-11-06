import { describe, expect, it } from "vitest"

import { parseVariantIndex, searchPage, searchText } from "./search-params"

describe("search params", () => {
  it("drops page 1 and junk so the bare URL stays canonical", () => {
    expect(searchPage("3")).toBe(3)
    expect(searchPage(1)).toBeUndefined()
    expect(searchPage("x")).toBeUndefined()
  })

  it("keeps a typed space in free text (a live input echoes it back)", () => {
    expect(searchText("foo ")).toBe("foo ")
    expect(searchText("")).toBeUndefined()
    expect(searchText("x".repeat(500))?.length).toBe(100)
  })

  it("accepts only non-negative variant indices", () => {
    expect(parseVariantIndex("2")).toBe(2)
    expect(parseVariantIndex(0)).toBe(0)
    expect(parseVariantIndex(-1)).toBeUndefined()
    expect(parseVariantIndex(null)).toBeUndefined()
  })
})
