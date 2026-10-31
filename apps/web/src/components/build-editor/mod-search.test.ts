import type { Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { isActionable, searchMods } from "./mod-search"

function mod(name: string): Mod {
  return {
    uniqueName: `/test/${name}`,
    name,
    polarity: "madurai",
    rarity: "Rare",
    baseDrain: 4,
    fusionLimit: 5,
    type: "Warframe Mod",
    tradable: true,
  }
}

const MODS = [
  "Archon Continuity",
  "Archon Flow",
  "Blind Rage",
  "Intensify",
].map(mod)
const INDEX = new Map(MODS.map((m) => [m.uniqueName, m.name.toLowerCase()]))

describe("searchMods", () => {
  it("floats the query's name match to the front", () => {
    const { displayed, matches } = searchMods(
      MODS,
      "blind rage",
      INDEX,
      undefined,
    )
    expect(displayed[0].name).toBe("Blind Rage")
    expect(matches.has("/test/Blind Rage")).toBe(true)
    expect(matches.has("/test/Archon Continuity")).toBe(false)
  })

  it("keeps the input order and matches everything for an empty query", () => {
    const { displayed, matches } = searchMods(MODS, "  ", INDEX, undefined)
    expect(displayed).toBe(MODS)
    expect(matches.size).toBe(MODS.length)
  })
})

describe("isActionable", () => {
  const all = new Set(MODS.map((m) => m.uniqueName))

  it("skips used, conflicting and non-matching mods", () => {
    const used = new Set(["Blind Rage"])
    const conflicts = new Set(["/test/Intensify"])
    const matches = new Set([...all].filter((u) => u !== "/test/Archon Flow"))
    expect(
      MODS.filter((m) => isActionable(m, matches, used, conflicts)).map(
        (m) => m.name,
      ),
    ).toEqual(["Archon Continuity"])
  })
})
