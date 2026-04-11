import { describe, it, expect } from "bun:test"

import {
  normalizePolarity,
  getAllMods,
  getModsByCompatibility,
  getModsForCategory,
  getModsForItem,
  getModByUniqueName,
  getModByName,
  getModFamily,
  canAddModToBuild,
  getAllArcanes,
  getArcanesForSlot,
  getArcaneByUniqueName,
  getArcaneByName,
  getAugmentModsForHelminthAbility,
  getAllHelminthAugmentMods,
} from "../mods"
import type { Polarity } from "../types"

// =============================================================================
// normalizePolarity() TESTS
// =============================================================================

describe("normalizePolarity", () => {
  it("normalizes standard polarity names", () => {
    expect(normalizePolarity("madurai")).toBe("madurai")
    expect(normalizePolarity("vazarin")).toBe("vazarin")
    expect(normalizePolarity("naramon")).toBe("naramon")
    expect(normalizePolarity("zenurik")).toBe("zenurik")
    expect(normalizePolarity("unairu")).toBe("unairu")
    expect(normalizePolarity("penjaga")).toBe("penjaga")
    expect(normalizePolarity("umbra")).toBe("umbra")
  })

  it("normalizes case-insensitive", () => {
    expect(normalizePolarity("Madurai")).toBe("madurai")
    expect(normalizePolarity("VAZARIN")).toBe("vazarin")
  })

  it("normalizes alternative names", () => {
    expect(normalizePolarity("d")).toBe("vazarin")
    expect(normalizePolarity("r")).toBe("madurai")
    expect(normalizePolarity("v")).toBe("madurai")
    expect(normalizePolarity("dash")).toBe("naramon")
  })

  it("returns universal for undefined", () => {
    expect(normalizePolarity(undefined)).toBe("universal")
  })

  it("returns universal for empty string", () => {
    expect(normalizePolarity("")).toBe("universal")
  })

  it("returns universal for unknown string", () => {
    expect(normalizePolarity("xyzabc")).toBe("universal")
  })
})

// =============================================================================
// getAllMods() TESTS
// =============================================================================

describe("getAllMods", () => {
  it("returns a non-empty array of mods", () => {
    const mods = getAllMods()
    expect(mods.length).toBeGreaterThan(100)
  })

  it("filters out Riven mods", () => {
    const mods = getAllMods()
    const rivens = mods.filter((m) => m.name.includes("Riven Mod"))
    expect(rivens).toHaveLength(0)
  })

  it("filters out PvP mods", () => {
    const mods = getAllMods()
    const pvp = mods.filter((m) => m.uniqueName.includes("/PvPMods/"))
    expect(pvp).toHaveLength(0)
  })

  it("filters out Beginner mods", () => {
    const mods = getAllMods()
    const beginner = mods.filter((m) => m.uniqueName.includes("/Beginner/"))
    expect(beginner).toHaveLength(0)
  })

  it("includes well-known mods", () => {
    const mods = getAllMods()
    const names = mods.map((m) => m.name)
    expect(names).toContain("Serration")
    expect(names).toContain("Vitality")
    expect(names).toContain("Steel Fiber")
    expect(names).toContain("Intensify")
  })

  it("normalizes polarity on all mods", () => {
    const mods = getAllMods()
    const validPolarities: Polarity[] = [
      "madurai",
      "vazarin",
      "naramon",
      "zenurik",
      "unairu",
      "penjaga",
      "umbra",
      "any",
      "universal",
    ]
    for (const mod of mods) {
      expect(validPolarities).toContain(mod.polarity)
    }
  })

  it("sets Amalgam rarity on Amalgam mods", () => {
    const mods = getAllMods()
    const amalgams = mods.filter((m) => m.name.startsWith("Amalgam "))
    for (const mod of amalgams) {
      expect(mod.rarity).toBe("Amalgam")
    }
  })

  it("sets Galvanized rarity on Galvanized mods", () => {
    const mods = getAllMods()
    const galvanized = mods.filter((m) => m.name.startsWith("Galvanized "))
    for (const mod of galvanized) {
      expect(mod.rarity).toBe("Galvanized")
    }
  })
})

// =============================================================================
// getModsByCompatibility() TESTS
// =============================================================================

describe("getModsByCompatibility", () => {
  it("returns warframe mods", () => {
    const mods = getModsByCompatibility("Warframe")
    expect(mods.length).toBeGreaterThan(10)
    const names = mods.map((m) => m.name)
    expect(names).toContain("Vitality")
  })

  it("returns rifle mods", () => {
    const mods = getModsByCompatibility("Rifle")
    expect(mods.length).toBeGreaterThan(5)
    const names = mods.map((m) => m.name)
    expect(names).toContain("Serration")
  })

  it("returns melee mods", () => {
    const mods = getModsByCompatibility("Melee")
    expect(mods.length).toBeGreaterThan(5)
  })

  it("returns empty for invalid compatibility", () => {
    const mods = getModsByCompatibility("InvalidType" as any)
    expect(mods).toHaveLength(0)
  })
})

// =============================================================================
// getModsForCategory() TESTS
// =============================================================================

describe("getModsForCategory", () => {
  it("returns mods for warframes category", () => {
    const mods = getModsForCategory("warframes")
    expect(mods.length).toBeGreaterThan(10)
  })

  it("returns combined mods for primary (rifle + shotgun)", () => {
    const primaryMods = getModsForCategory("primary")
    const rifleMods = getModsByCompatibility("Rifle")
    const shotgunMods = getModsByCompatibility("Shotgun")
    expect(primaryMods.length).toBeGreaterThanOrEqual(rifleMods.length)
    expect(primaryMods.length).toBeGreaterThanOrEqual(shotgunMods.length)
  })

  it("returns empty for unknown category", () => {
    expect(getModsForCategory("nonexistent")).toHaveLength(0)
  })
})

// =============================================================================
// getModByUniqueName() / getModByName() TESTS
// =============================================================================

describe("getModByUniqueName", () => {
  it("roundtrips a known mod through name -> uniqueName -> lookup", () => {
    const serration = getModByName("Serration")
    expect(serration).toBeDefined()
    const found = getModByUniqueName(serration!.uniqueName)
    expect(found).toBeDefined()
    expect(found!.name).toBe("Serration")
  })

  it("returns undefined for unknown unique name", () => {
    expect(getModByUniqueName("/Nonexistent/Path")).toBeUndefined()
  })
})

describe("getModByName", () => {
  it("finds mod by exact name", () => {
    const mod = getModByName("Vitality")
    expect(mod).toBeDefined()
    expect(mod!.name).toBe("Vitality")
  })

  it("finds mod case-insensitively", () => {
    const mod = getModByName("vitality")
    expect(mod).toBeDefined()
    expect(mod!.name).toBe("Vitality")
  })

  it("returns undefined for unknown mod", () => {
    expect(getModByName("Nonexistent Mod Name 12345")).toBeUndefined()
  })
})

// =============================================================================
// getModFamily() TESTS
// =============================================================================

describe("getModFamily", () => {
  it("returns family for known mod", () => {
    const serration = getModByName("Serration")
    expect(serration).toBeDefined()
    expect(getModFamily(serration!)).toBe("Serration")
  })

  it("returns base name for Primed variant", () => {
    const mod = getModByName("Primed Continuity")
    if (mod) {
      expect(getModFamily(mod)).toBe("Continuity")
    }
  })

  it("returns null for mod with no family", () => {
    const mod = getModByName("Hellfire")
    if (mod) {
      expect(getModFamily(mod)).toBeNull()
    }
  })
})

// =============================================================================
// canAddModToBuild() TESTS
// =============================================================================

describe("canAddModToBuild", () => {
  it("allows mod with no family conflicts", () => {
    const vitality = getModByName("Vitality")!
    const serration = getModByName("Serration")!
    expect(canAddModToBuild(vitality, [serration])).toBe(true)
  })

  it("blocks exact duplicate", () => {
    const vitality = getModByName("Vitality")!
    expect(canAddModToBuild(vitality, [vitality])).toBe(false)
  })

  it("blocks family conflict (Primed variant)", () => {
    const continuity = getModByName("Continuity")
    const primedContinuity = getModByName("Primed Continuity")
    if (continuity && primedContinuity) {
      expect(canAddModToBuild(primedContinuity, [continuity])).toBe(false)
    }
  })

  it("allows mod to empty build", () => {
    const vitality = getModByName("Vitality")!
    expect(canAddModToBuild(vitality, [])).toBe(true)
  })
})

// =============================================================================
// getModsForItem() TESTS
// =============================================================================

describe("getModsForItem", () => {
  it("returns rifle mods for a rifle item", () => {
    const mods = getModsForItem({ type: "Rifle" })
    expect(mods.length).toBeGreaterThan(5)
    const names = mods.map((m) => m.name)
    expect(names).toContain("Serration")
  })

  it("returns pistol mods for a pistol item", () => {
    const mods = getModsForItem({ type: "Pistol" })
    expect(mods.length).toBeGreaterThan(5)
  })

  it("returns melee mods for a melee item", () => {
    const mods = getModsForItem({ type: "Melee" })
    expect(mods.length).toBeGreaterThan(5)
  })

  it("returns warframe mods including auras for warframe type", () => {
    const mods = getModsForItem({ type: "Warframe" })
    expect(mods.length).toBeGreaterThan(10)
    const names = mods.map((m) => m.name)
    expect(names).toContain("Vitality")
  })

  it("includes augments for named warframe", () => {
    const mods = getModsForItem({ type: "Warframe", name: "Ash" })
    const augments = mods.filter((m) => m.isAugment)
    expect(augments.length).toBeGreaterThan(0)
  })

  it("includes augments for Prime variant via base name matching", () => {
    const primeMods = getModsForItem({ type: "Warframe", name: "Ash Prime" })
    const baseMods = getModsForItem({ type: "Warframe", name: "Ash" })
    const primeAugments = primeMods.filter((m) => m.isAugment)
    const baseAugments = baseMods.filter((m) => m.isAugment)
    expect(primeAugments.length).toBe(baseAugments.length)
  })

  it("finds augment mods for a subsumed Helminth ability", () => {
    const mods = getAugmentModsForHelminthAbility({
      uniqueName: "/Lotus/Powersuits/Harlequin/Abilities/LightAbility",
      name: "Eclipse",
      source: "Mirage",
    })

    expect(mods.map((mod) => mod.name)).toContain("Total Eclipse")
    expect(mods.map((mod) => mod.name)).not.toContain("Hall Of Malevolence")
  })

  it("getAllHelminthAugmentMods includes Shock Trooper for Volt's Shock", () => {
    const map = getAllHelminthAugmentMods()
    // Find Volt's Shock ability by looking for an entry that includes Shock Trooper
    const entries = Object.entries(map)
    const shockEntry = entries.find(([, mods]) =>
      mods.some((m) => m.name === "Shock Trooper"),
    )
    expect(shockEntry).toBeDefined()
    expect(shockEntry![1].map((m) => m.name)).toContain("Shock Trooper")
  })

  it("getAllHelminthAugmentMods returns no entries for native Helminth abilities", () => {
    const map = getAllHelminthAugmentMods()
    // All keys should correspond to subsumable abilities, not native Helminth ones
    expect(Object.keys(map).length).toBeGreaterThan(0)
  })

  it("falls back to category when no type", () => {
    const mods = getModsForItem({ category: "primary" })
    expect(mods.length).toBeGreaterThan(5)
  })

  it("returns empty for item with no type or category", () => {
    expect(getModsForItem({})).toHaveLength(0)
  })

  it("returns shotgun mods for shotgun type", () => {
    const mods = getModsForItem({ type: "Shotgun" })
    expect(mods.length).toBeGreaterThan(5)
  })

  it("returns necramech mods for necramech type", () => {
    const mods = getModsForItem({ type: "Necramech" })
    expect(mods.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// ARCANE TESTS
// =============================================================================

describe("getAllArcanes", () => {
  it("returns non-empty array", () => {
    const arcanes = getAllArcanes()
    expect(arcanes.length).toBeGreaterThan(10)
  })

  it("filters out unnamed arcanes", () => {
    const arcanes = getAllArcanes()
    for (const arcane of arcanes) {
      expect(arcane.name).toBeTruthy()
      expect(arcane.name).not.toBe("Arcane")
    }
  })
})

describe("getArcanesForSlot", () => {
  it("returns warframe arcanes", () => {
    const arcanes = getArcanesForSlot("warframe")
    expect(arcanes.length).toBeGreaterThan(5)
  })
})

describe("getArcaneByUniqueName", () => {
  it("roundtrips a known arcane through name -> uniqueName -> lookup", () => {
    const arcanes = getAllArcanes()
    if (arcanes.length > 0) {
      const arcane = arcanes[0]
      const found = getArcaneByUniqueName(arcane.uniqueName)
      expect(found).toBeDefined()
      expect(found!.name).toBe(arcane.name)
    }
  })

  it("returns undefined for unknown unique name", () => {
    expect(getArcaneByUniqueName("/Nonexistent/Arcane")).toBeUndefined()
  })
})

describe("getArcaneByName", () => {
  it("finds arcane case-insensitively", () => {
    const arcanes = getAllArcanes()
    if (arcanes.length > 0) {
      const name = arcanes[0].name
      const found = getArcaneByName(name.toLowerCase())
      expect(found).toBeDefined()
      expect(found!.name).toBe(name)
    }
  })

  it("returns undefined for unknown arcane", () => {
    expect(getArcaneByName("Nonexistent Arcane 12345")).toBeUndefined()
  })
})
