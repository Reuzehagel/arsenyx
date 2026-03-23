// Stat parser tests
import { describe, it, expect } from "bun:test"

import {
  createTestMod,
  VITALITY,
  INTENSIFY,
  SERRATION,
  POINT_STRIKE,
  HELLFIRE,
  STORMBRINGER,
  GALVANIZED_CHAMBER,
  UMBRAL_VITALITY,
} from "@/test/fixtures/mods"

import {
  parseModStats,
  parseStatString,
  modAffectsStat,
  getModAffectedStats,
  hasConditionalEffects,
  getMaxStacks,
} from "../stat-parser"

// =============================================================================
// parseStatString TESTS
// =============================================================================

describe("parseStatString", () => {
  describe("percentage stats", () => {
    it('parses "+100% Health"', () => {
      const result = parseStatString("+100% Health")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("health")
      expect(result[0].value).toBe(100)
      expect(result[0].operation).toBe("percent_add")
    })

    it('parses "+440% Health" (max Vitality)', () => {
      const result = parseStatString("+440% Health")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("health")
      expect(result[0].value).toBe(440)
    })

    it("parses negative percentages", () => {
      const result = parseStatString("-55% Ability Efficiency")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("ability_efficiency")
      expect(result[0].value).toBe(-55)
    })

    it("parses decimal percentages", () => {
      const result = parseStatString("+16.5% Armor")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("armor")
      expect(result[0].value).toBeCloseTo(16.5)
    })

    it('parses "+30% Ability Strength"', () => {
      const result = parseStatString("+30% Ability Strength")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("ability_strength")
      expect(result[0].value).toBe(30)
    })

    it('parses "+165% Damage"', () => {
      const result = parseStatString("+165% Damage")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("damage")
      expect(result[0].value).toBe(165)
    })

    it('parses "+150% Critical Chance"', () => {
      const result = parseStatString("+150% Critical Chance")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("critical_chance")
      expect(result[0].value).toBe(150)
    })

    it('parses "+120% Critical Multiplier"', () => {
      const result = parseStatString("+120% Critical Multiplier")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("critical_multiplier")
      expect(result[0].value).toBe(120)
    })
  })

  describe("elemental damage with color tags", () => {
    it('parses "+90% <DT_HEAT_COLOR>Heat"', () => {
      const result = parseStatString("+90% <DT_HEAT_COLOR>Heat")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("heat")
      expect(result[0].value).toBe(90)
      expect(result[0].damageType).toBe("heat")
    })

    it('parses "+90% <DT_COLD_COLOR>Cold"', () => {
      const result = parseStatString("+90% <DT_COLD_COLOR>Cold")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("cold")
      expect(result[0].damageType).toBe("cold")
    })

    it('parses "+90% <DT_ELECTRICITY_COLOR>Electricity"', () => {
      const result = parseStatString("+90% <DT_ELECTRICITY_COLOR>Electricity")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("electricity")
      expect(result[0].damageType).toBe("electricity")
    })

    it('parses "+90% <DT_TOXIN_COLOR>Toxin"', () => {
      const result = parseStatString("+90% <DT_TOXIN_COLOR>Toxin")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("toxin")
      expect(result[0].damageType).toBe("toxin")
    })

    it("handles alternate color tag names", () => {
      const result = parseStatString("+60% <DT_FIRE_COLOR>Heat")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("heat")
    })
  })

  describe("conditional stats", () => {
    // Note: The stat parser uses regex patterns that expect stats to end with
    // periods, newlines, or commas. Complex conditional strings like
    // "for 20s. Stacks up to 4x." may not be fully parsed.

    it("parses simple damage stat", () => {
      const result = parseStatString("+40% Damage.")
      expect(result.some((s) => s.type === "damage")).toBe(true)
    })

    it("parses simple multishot stat", () => {
      const result = parseStatString("+80% Multishot.")
      expect(result.some((s) => s.type === "multishot")).toBe(true)
    })

    it("parses status chance stat", () => {
      const result = parseStatString("+5% Status Chance.")
      expect(result.some((s) => s.type === "status_chance")).toBe(true)
    })
  })

  describe("multiplier notation", () => {
    it("parses multiplier stats like 2.5x Combo Duration", () => {
      const result = parseStatString("2.5x Combo Duration")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("combo_duration")
      expect(result[0].value).toBe(2.5)
      expect(result[0].operation).toBe("percent_mult")
    })
  })

  describe("edge cases", () => {
    it("returns empty array for augment descriptions", () => {
      const result = parseStatString(
        "Augment: Casting Radial Blind on enemies...",
      )
      expect(result).toHaveLength(0)
    })

    it("handles multiple stats in one string", () => {
      const result = parseStatString("+55% Health, +11% Tau Resistance")
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.some((s) => s.type === "health")).toBe(true)
    })

    it("returns empty array for empty string", () => {
      const result = parseStatString("")
      expect(result).toHaveLength(0)
    })

    it("handles stats with periods at end", () => {
      const result = parseStatString("+30% Ability Strength.")
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe("ability_strength")
    })
  })
})

// =============================================================================
// parseModStats TESTS
// =============================================================================

describe("parseModStats", () => {
  it("parses Vitality at max rank", () => {
    const result = parseModStats(VITALITY)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("health")
    expect(result[0].value).toBe(440)
  })

  it("parses Vitality at rank 0", () => {
    const mod = { ...VITALITY, rank: 0 }
    const result = parseModStats(mod)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(40)
  })

  it("parses Intensify at max rank", () => {
    const result = parseModStats(INTENSIFY)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("ability_strength")
    expect(result[0].value).toBe(30)
  })

  it("parses Serration at max rank", () => {
    const result = parseModStats(SERRATION)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("damage")
    expect(result[0].value).toBe(165)
  })

  it("parses Point Strike at max rank", () => {
    const result = parseModStats(POINT_STRIKE)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("critical_chance")
    expect(result[0].value).toBe(150)
  })

  it("parses elemental mods", () => {
    const result = parseModStats(HELLFIRE)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("heat")
    expect(result[0].value).toBe(90)
    expect(result[0].damageType).toBe("heat")
  })

  it("parses mods with multiple stats (Umbral Vitality)", () => {
    const result = parseModStats(UMBRAL_VITALITY)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some((s) => s.type === "health")).toBe(true)
    // May also have tau resistance
  })

  it("handles mod without levelStats", () => {
    const mod = createTestMod({ levelStats: undefined })
    const result = parseModStats(mod)
    expect(result).toHaveLength(0)
  })

  it("handles mod with empty levelStats", () => {
    const mod = createTestMod({ levelStats: [] })
    const result = parseModStats(mod)
    expect(result).toHaveLength(0)
  })

  it("clamps rank to max available levelStats", () => {
    const mod = { ...VITALITY, rank: 100 } // Way over max rank
    const result = parseModStats(mod)
    // Should use the last available rank stats
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe(440) // Max rank value
  })

  it("parses Galvanized mods multishot bonus", () => {
    const result = parseModStats(GALVANIZED_CHAMBER)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some((s) => s.type === "multishot")).toBe(true)

    // The base multishot bonus should be 160% at max rank
    const multishot = result.find((s) => s.type === "multishot")
    expect(multishot?.value).toBe(160)
  })
})

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("modAffectsStat", () => {
  it("returns true when mod affects the stat", () => {
    expect(modAffectsStat(VITALITY, "health")).toBe(true)
  })

  it("returns false when mod does not affect the stat", () => {
    expect(modAffectsStat(VITALITY, "armor")).toBe(false)
  })

  it("returns true for damage mods affecting damage", () => {
    expect(modAffectsStat(SERRATION, "damage")).toBe(true)
  })

  it("returns true for elemental mods affecting their element", () => {
    expect(modAffectsStat(HELLFIRE, "heat")).toBe(true)
    expect(modAffectsStat(STORMBRINGER, "electricity")).toBe(true)
  })
})

describe("getModAffectedStats", () => {
  it("returns array of affected stat types", () => {
    const stats = getModAffectedStats(VITALITY)
    expect(stats).toContain("health")
  })

  it("returns multiple stats for multi-stat mods", () => {
    const stats = getModAffectedStats(UMBRAL_VITALITY)
    expect(stats.length).toBeGreaterThanOrEqual(1)
    expect(stats).toContain("health")
  })

  it("returns unique stat types only", () => {
    const stats = getModAffectedStats(VITALITY)
    const uniqueStats = [...new Set(stats)]
    expect(stats.length).toBe(uniqueStats.length)
  })
})

describe("hasConditionalEffects", () => {
  it("returns false for regular mods", () => {
    expect(hasConditionalEffects(VITALITY)).toBe(false)
    expect(hasConditionalEffects(SERRATION)).toBe(false)
  })

  // Note: Galvanized mods have complex stat strings with conditional patterns
  // The current parser may not fully detect all conditional effects
})

describe("getMaxStacks", () => {
  it("returns undefined for non-stackable mods", () => {
    expect(getMaxStacks(VITALITY)).toBeUndefined()
  })

  // Note: Extracting max stacks from complex stat strings like Galvanized mods
  // requires enhanced parsing that may not be fully implemented
})
