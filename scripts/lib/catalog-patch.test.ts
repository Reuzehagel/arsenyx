import { describe, expect, test } from "bun:test"

import { patch } from "./catalog-patch"

const run = (base: unknown, fixed: unknown, head: unknown) =>
  patch(head, base, fixed, "", [])

const kept = { uniqueName: "/kept", rarity: "Common" }

describe("data:patch", () => {
  test("adds a record the fix introduces", () => {
    const added = { uniqueName: "/added", rarity: "Rare" }
    expect(run([kept], [kept, added], [kept])).toEqual([kept, added])
  })

  test("a re-run refreshes a record an earlier run added", () => {
    const first = { uniqueName: "/added", rarity: "Common" }
    const edited = { uniqueName: "/added", rarity: "Rare" }
    expect(run([kept], [kept, edited], [kept, first])).toEqual([kept, edited])
  })

  test("keeps a committed record upstream has since dropped", () => {
    const dropped = { uniqueName: "/dropped", rarity: "Common" }
    const edit = { uniqueName: "/kept", rarity: "Rare" }
    expect(run([kept], [edit], [kept, dropped])).toEqual([edit, dropped])
  })
})
