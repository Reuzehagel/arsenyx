import { describe, expect, it } from "vitest"

import { LIST_COLUMNS_SQL, LIST_SELECT, parseListQuery } from "./_build-list"

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

// runList reads lists with LIST_COLUMNS_SQL and serializes the rows with the
// same serializeListRow as the Prisma (search) path, so a field added to
// LIST_SELECT but not to the SQL would silently go missing from most lists.

/** Split at top-level commas (not inside parentheses). */
function topLevelItems(sql: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of sql) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) {
      out.push(cur.trim())
      cur = ""
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** The column a select item produces: its alias, else the column itself. */
const columnName = (item: string) =>
  (/\bAS\s+"?(\w+)"?\s*$/i.exec(item)?.[1] ?? item).replace(/"/g, "")

describe("LIST_COLUMNS_SQL", () => {
  it("produces exactly LIST_SELECT's columns, in order", () => {
    const columns = topLevelItems(LIST_COLUMNS_SQL.text).map(columnName)
    expect(columns).toEqual(Object.keys(LIST_SELECT))
  })

  it("builds each relation object with exactly its select's keys", () => {
    const items = topLevelItems(LIST_COLUMNS_SQL.text)
    for (const rel of ["user", "organization"] as const) {
      const item = items.find((i) => columnName(i) === rel)!
      const keys = [...item.matchAll(/'(\w+)',/g)].map((m) => m[1])
      expect(keys).toEqual(Object.keys(LIST_SELECT[rel].select))
    }
  })
})
