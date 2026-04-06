import { describe, it, expect } from "bun:test"

import { matchItemByName, matchModByName } from "../match"
import type { BrowseItem, Mod } from "@/lib/warframe/types"

// Minimal stubs for test data
function makeItem(name: string, slug: string): BrowseItem {
  return {
    uniqueName: `/Lotus/Items/${name.replace(/\s/g, "")}`,
    name,
    slug,
    imageName: `${name}.png`,
    masteryReq: 0,
    category: "primary",
  } as BrowseItem
}

function makeMod(name: string): Mod {
  return {
    uniqueName: `/Lotus/Mods/${name.replace(/\s/g, "")}`,
    name,
    imageName: `${name}.png`,
    polarity: "madurai",
    baseDrain: 4,
    fusionLimit: 5,
    rarity: "Rare",
  } as Mod
}

// =============================================================================
// matchItemByName
// =============================================================================

describe("matchItemByName", () => {
  const candidates = [
    makeItem("Braton Prime", "braton-prime"),
    makeItem("Boltor Prime", "boltor-prime"),
    makeItem("Paris Prime", "paris-prime"),
    makeItem("Ignis Wraith", "ignis-wraith"),
  ]

  it("returns exact match with score 1", () => {
    const result = matchItemByName("Braton Prime", candidates)
    expect(result.item?.name).toBe("Braton Prime")
    expect(result.score).toBe(1)
  })

  it("matches by slug when name is close", () => {
    const result = matchItemByName("braton-prime", candidates)
    expect(result.item?.name).toBe("Braton Prime")
    expect(result.score).toBe(1)
  })

  it("returns null for very different names (below threshold)", () => {
    const result = matchItemByName("Completely Unrelated Weapon", candidates)
    expect(result.item).toBeNull()
  })

  it("returns null for undefined input", () => {
    const result = matchItemByName(undefined, candidates)
    expect(result.item).toBeNull()
    expect(result.score).toBe(0)
  })

  it("returns null for empty string", () => {
    const result = matchItemByName("", candidates)
    expect(result.item).toBeNull()
  })

  it("returns null for empty candidates", () => {
    const result = matchItemByName("Braton Prime", [])
    expect(result.item).toBeNull()
  })

  it("picks the best match among similar names", () => {
    const result = matchItemByName("Boltor Prime", candidates)
    expect(result.item?.name).toBe("Boltor Prime")
    expect(result.score).toBe(1)
  })
})

// =============================================================================
// matchModByName
// =============================================================================

describe("matchModByName", () => {
  const mods = [
    makeMod("Serration"),
    makeMod("Split Chamber"),
    makeMod("Primed Continuity"),
    makeMod("Heavy Caliber"),
    makeMod("Vital Sense"),
  ]

  it("returns exact match with score 1", () => {
    const result = matchModByName("Serration", mods)
    expect(result.mod?.name).toBe("Serration")
    expect(result.score).toBe(1)
  })

  it("matches case-insensitive", () => {
    const result = matchModByName("serration", mods)
    expect(result.mod?.name).toBe("Serration")
    expect(result.score).toBe(1)
  })

  it("expands parenthetical variants to find a match", () => {
    // Overframe might report "Continuity (Primed)" → should match "Primed Continuity"
    const result = matchModByName("Continuity (Primed)", mods)
    expect(result.mod?.name).toBe("Primed Continuity")
    expect(result.score).toBe(1)
  })

  it("returns null for names below the 0.78 threshold", () => {
    const result = matchModByName("Totally Different Mod Name", mods)
    expect(result.mod).toBeNull()
  })

  it("returns the best variant name on match", () => {
    const result = matchModByName("Continuity (Primed)", mods)
    expect(result.bestName).toBeDefined()
  })

  it("handles close fuzzy matches above threshold", () => {
    // "Serraton" is 1 edit from "Serration" → similarity ~0.89
    const result = matchModByName("Serraton", mods)
    expect(result.mod?.name).toBe("Serration")
    expect(result.score).toBeGreaterThan(0.78)
  })

  it("returns null for empty mod list", () => {
    const result = matchModByName("Serration", [])
    expect(result.mod).toBeNull()
  })
})
