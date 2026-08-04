import { describe, expect, it } from "vitest"

import { parseListQuery } from "./_build-list"

// Minimal stand-in for the Hono context slice parseListQuery reads.
function ctx(query: Record<string, string>) {
  return { req: { query: (k: string) => query[k] } }
}

describe("parseListQuery", () => {
  it("leaves boolean filters unset when absent", () => {
    const f = parseListQuery(ctx({}))
    expect(f.hasGuide).toBeUndefined()
    expect(f.hasShards).toBeUndefined()
  })

  it("parses hasGuide=false as a real filter, not an absent one", () => {
    // The bug in issue #319: `false` used to collapse to the same value as
    // "param omitted", so there was no way to ask for builds WITHOUT a guide.
    expect(parseListQuery(ctx({ hasGuide: "false" })).hasGuide).toBe(false)
    expect(parseListQuery(ctx({ hasGuide: "False" })).hasGuide).toBe(false)
    expect(parseListQuery(ctx({ hasGuide: "0" })).hasGuide).toBe(false)
  })

  it("still accepts the =1 form the web client sends", () => {
    const f = parseListQuery(ctx({ hasGuide: "1", hasShards: "1" }))
    expect(f.hasGuide).toBe(true)
    expect(f.hasShards).toBe(true)
  })

  it("accepts hasShards=true, which previously did nothing", () => {
    expect(parseListQuery(ctx({ hasShards: "true" })).hasShards).toBe(true)
  })

  it("clamps limit and page", () => {
    expect(parseListQuery(ctx({ limit: "9999" })).limit).toBe(24)
    expect(parseListQuery(ctx({ page: "999999" })).page).toBe(500)
  })

  it("drops an unknown category and sort instead of erroring", () => {
    const f = parseListQuery(ctx({ category: "bogus", sort: "sideways" }))
    expect(f.category).toBeUndefined()
    expect(f.sort).toBeUndefined()
  })

  it("passes item through as an opaque uniqueName", () => {
    const item = "/Lotus/Powersuits/Archwing/SupportJetPack/SupportJetPack"
    expect(parseListQuery(ctx({ item })).item).toBe(item)
  })
})
