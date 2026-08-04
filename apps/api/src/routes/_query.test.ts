import { describe, expect, it } from "vitest"

import { parseBool, parsePage, trimQ } from "./_query"

describe("parsePage", () => {
  it("defaults to 1 for absent, non-numeric, zero and negative input", () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage("")).toBe(1)
    expect(parsePage("abc")).toBe(1)
    expect(parsePage("0")).toBe(1)
    expect(parsePage("-5")).toBe(1)
  })

  it("passes through ordinary page numbers", () => {
    expect(parsePage("1")).toBe(1)
    expect(parsePage("2")).toBe(2)
    expect(parsePage("500")).toBe(500)
  })

  it("clamps absurd page numbers", () => {
    // Pagination is OFFSET-based, so an unbounded page number lets an
    // anonymous caller make Postgres walk and discard millions of rows per
    // request. Without the clamp `?page=999999` reaches OFFSET ~24M.
    expect(parsePage("501")).toBe(500)
    expect(parsePage("999999")).toBe(500)
    expect(parsePage("99999999999999999999")).toBe(500)
  })
})

describe("parseBool", () => {
  it("returns undefined when the param is absent", () => {
    expect(parseBool(undefined)).toBeUndefined()
  })

  it("accepts the documented truthy spellings", () => {
    for (const v of ["1", "true", "yes", "on", "TRUE", "Yes", " on "]) {
      expect(parseBool(v)).toBe(true)
    }
  })

  it("accepts the documented falsy spellings", () => {
    // Issue #319: only "1" used to parse, so `hasGuide=false` was silently
    // identical to omitting the param and builds with guides still came back.
    for (const v of ["0", "false", "no", "off", "False", "OFF", " 0 "]) {
      expect(parseBool(v)).toBe(false)
    }
  })

  it("reads a bare key as true", () => {
    // Hono surfaces `?hasGuide` (no `=`) as an empty string.
    expect(parseBool("")).toBe(true)
  })

  it("ignores unrecognized values rather than guessing", () => {
    // Notably NOT false — junk means "no filter", matching how `sort` and
    // `category` already treat unparseable input on these routes.
    expect(parseBool("maybe")).toBeUndefined()
    expect(parseBool("2")).toBeUndefined()
    expect(parseBool("null")).toBeUndefined()
  })
})

describe("trimQ", () => {
  it("collapses blank input to undefined", () => {
    expect(trimQ(undefined)).toBeUndefined()
    expect(trimQ("")).toBeUndefined()
    expect(trimQ("   ")).toBeUndefined()
  })

  it("trims and truncates to the max length", () => {
    expect(trimQ("  hi  ")).toBe("hi")
    expect(trimQ("a".repeat(150))).toHaveLength(100)
    expect(trimQ("a".repeat(300), 200)).toHaveLength(200)
  })
})
