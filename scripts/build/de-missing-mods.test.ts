import { describe, expect, it } from "bun:test"

import { injectMissingDeMods } from "./de-missing-mods"
import type { DeUpgrade } from "./read-de"

const de = (uniqueName: string, name: string): DeUpgrade => ({
  uniqueName,
  name,
})

describe("injectMissingDeMods", () => {
  const curated = [de("/Mods/A", "A"), de("/Mods/B", "B")]

  it("appends curated records DE lacks", () => {
    const raw = [de("/Mods/X", "X")]
    const r = injectMissingDeMods(raw, curated)
    expect(r.upgrades.map((u) => u.uniqueName)).toEqual([
      "/Mods/X",
      "/Mods/A",
      "/Mods/B",
    ])
    expect(r.injected).toEqual(["A", "B"])
    expect(r.resurfaced).toEqual([])
    // Input untouched.
    expect(raw).toHaveLength(1)
  })

  it("skips (and reports) records DE ships again", () => {
    const raw = [de("/Mods/A", "A (DE)")]
    const r = injectMissingDeMods(raw, curated)
    expect(r.upgrades.map((u) => u.name)).toEqual(["A (DE)", "B"])
    expect(r.injected).toEqual(["B"])
    expect(r.resurfaced).toEqual(["A"])
  })
})
