import { describe, it, expect } from "bun:test"

import {
  RIVEN_STATS,
  RIVEN_ELIGIBLE_CATEGORIES,
  createSyntheticRiven,
  isRivenMod,
} from "../rivens"

describe("RIVEN_STATS", () => {
  it("contains 31 stat names", () => {
    expect(RIVEN_STATS).toHaveLength(31)
  })

  it("includes known stats", () => {
    expect(RIVEN_STATS).toContain("Critical Chance")
    expect(RIVEN_STATS).toContain("Damage")
    expect(RIVEN_STATS).toContain("Multishot")
    expect(RIVEN_STATS).toContain("Zoom")
  })

  it("includes melee-specific stats", () => {
    expect(RIVEN_STATS).toContain("Attack Speed")
    expect(RIVEN_STATS).toContain("Range")
    expect(RIVEN_STATS).toContain("Combo Duration")
  })
})

describe("RIVEN_ELIGIBLE_CATEGORIES", () => {
  it("includes weapon categories", () => {
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("primary")).toBe(true)
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("secondary")).toBe(true)
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("melee")).toBe(true)
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("archwing")).toBe(true)
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("companion-weapons")).toBe(true)
  })

  it("excludes non-weapon categories", () => {
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("warframes")).toBe(false)
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("companions")).toBe(false)
    expect(RIVEN_ELIGIBLE_CATEGORIES.has("necramechs")).toBe(false)
  })
})

describe("createSyntheticRiven", () => {
  it("creates a mod with Riven rarity", () => {
    const riven = createSyntheticRiven()
    expect(riven.rarity).toBe("Riven")
    expect(riven.name).toBe("Riven Mod")
    expect(riven.uniqueName).toBe("/riven")
    expect(riven.fusionLimit).toBe(8)
    expect(riven.baseDrain).toBe(0)
  })
})

describe("isRivenMod", () => {
  it("returns true for riven uniqueName", () => {
    expect(isRivenMod({ uniqueName: "/riven" })).toBe(true)
  })

  it("returns false for normal mod", () => {
    expect(isRivenMod({ uniqueName: "/Lotus/Upgrades/Mods/Rifle/DamageMod" })).toBe(false)
  })
})
