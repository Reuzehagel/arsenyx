// Capacity calculator tests
import { describe, it, expect } from "bun:test"

import { createEmptyBuildState, createModSlot } from "@/test/fixtures/builds"
import { createTestMod, STEEL_CHARGE } from "@/test/fixtures/mods"

import {
  calculateModDrain,
  calculateAuraBonus,
  calculateSlotDrain,
  calculateTotalDrain,
  calculateMaxCapacity,
  calculateRemainingCapacity,
  getCapacityStatus,
  getSlotPolarity,
  calculateFormaCount,
  calculateModEndoCost,
  getMatchState,
  wouldMatchPolarity,
  wouldMismatchPolarity,
} from "../capacity"
import type { ModSlot, Polarity } from "../types"

// =============================================================================
// DRAIN CALCULATION TESTS
// =============================================================================

describe("calculateModDrain", () => {
  it("returns base drain for neutral polarity slot", () => {
    const mod = createTestMod({ baseDrain: 4, rank: 5 })
    // No slot polarity = neutral
    expect(calculateModDrain(mod, undefined)).toBe(9) // 4 + 5
  })

  it("returns base drain for universal polarity slot", () => {
    const mod = createTestMod({ baseDrain: 4, rank: 5 })
    expect(calculateModDrain(mod, "universal")).toBe(9)
  })

  it("halves drain for any polarity slot (non-Umbra)", () => {
    const mod = createTestMod({
      baseDrain: 4,
      rank: 5,
      polarity: "madurai" as Polarity,
    })
    // (4 + 5) / 2 = 4.5 -> ceil = 5
    expect(calculateModDrain(mod, "any")).toBe(5)
  })

  it("treats any polarity slot as neutral for Umbra mods", () => {
    const mod = createTestMod({
      baseDrain: 4,
      rank: 5,
      polarity: "umbra" as Polarity,
    })
    expect(calculateModDrain(mod, "any")).toBe(9)
  })

  it("halves drain for matching polarity (rounded up)", () => {
    const mod = createTestMod({
      baseDrain: 4,
      rank: 5,
      polarity: "madurai" as Polarity,
    })
    // (4 + 5) / 2 = 4.5, ceil = 5
    expect(calculateModDrain(mod, "madurai")).toBe(5)
  })

  it("halves drain for matching polarity with even result", () => {
    const mod = createTestMod({
      baseDrain: 4,
      rank: 6,
      polarity: "vazarin" as Polarity,
    })
    // (4 + 6) / 2 = 5
    expect(calculateModDrain(mod, "vazarin")).toBe(5)
  })

  it("adds 25% penalty for mismatched polarity (rounded up)", () => {
    const mod = createTestMod({
      baseDrain: 4,
      rank: 5,
      polarity: "madurai" as Polarity,
    })
    // (4 + 5) * 1.25 = 11.25, ceiling = 12
    expect(calculateModDrain(mod, "vazarin")).toBe(12)
  })

  it("adds 25% penalty for mismatched polarity with round result", () => {
    const mod = createTestMod({
      baseDrain: 4,
      rank: 4,
      polarity: "madurai" as Polarity,
    })
    // (4 + 4) * 1.25 = 10
    expect(calculateModDrain(mod, "naramon")).toBe(10)
  })

  it("handles rank 0 mods", () => {
    const mod = createTestMod({ baseDrain: 6, rank: 0 })
    expect(calculateModDrain(mod, undefined)).toBe(6)
  })

  it("handles high rank mods with matching polarity", () => {
    // Maxed Vitality-like mod
    const mod = createTestMod({
      baseDrain: 2,
      rank: 10,
      polarity: "vazarin" as Polarity,
    })
    // (2 + 10) / 2 = 6
    expect(calculateModDrain(mod, "vazarin")).toBe(6)
  })
})

// =============================================================================
// SLOT POLARITY TESTS
// =============================================================================

describe("getSlotPolarity", () => {
  it("returns innate polarity when no forma applied", () => {
    const slot: ModSlot = {
      id: "test",
      type: "normal",
      innatePolarity: "madurai",
    }
    expect(getSlotPolarity(slot)).toBe("madurai")
  })

  it("returns forma polarity when applied", () => {
    const slot: ModSlot = {
      id: "test",
      type: "normal",
      innatePolarity: "madurai",
      formaPolarity: "vazarin",
    }
    expect(getSlotPolarity(slot)).toBe("vazarin")
  })

  it("returns undefined when forma is universal (cleared)", () => {
    const slot: ModSlot = {
      id: "test",
      type: "normal",
      innatePolarity: "madurai",
      formaPolarity: "universal",
    }
    expect(getSlotPolarity(slot)).toBeUndefined()
  })

  it("returns undefined for slot with no polarity", () => {
    const slot: ModSlot = {
      id: "test",
      type: "normal",
    }
    expect(getSlotPolarity(slot)).toBeUndefined()
  })
})

// =============================================================================
// SLOT DRAIN TESTS
// =============================================================================

describe("calculateSlotDrain", () => {
  it("returns 0 for empty slot", () => {
    const slot = createModSlot("test", "normal")
    expect(calculateSlotDrain(slot)).toBe(0)
  })

  it("calculates drain for slot with mod", () => {
    const mod = createTestMod({ baseDrain: 4, rank: 5, polarity: "madurai" })
    const slot: ModSlot = {
      id: "test",
      type: "normal",
      innatePolarity: "madurai",
      mod,
    }
    // Matching polarity: ceil((4 + 5) / 2) = 5
    expect(calculateSlotDrain(slot)).toBe(5)
  })

  it("uses forma polarity over innate", () => {
    const mod = createTestMod({ baseDrain: 4, rank: 5, polarity: "vazarin" })
    const slot: ModSlot = {
      id: "test",
      type: "normal",
      innatePolarity: "madurai",
      formaPolarity: "vazarin",
      mod,
    }
    // Forma matches: ceil((4 + 5) / 2) = 5
    expect(calculateSlotDrain(slot)).toBe(5)
  })
})

// =============================================================================
// AURA BONUS TESTS
// =============================================================================

describe("calculateAuraBonus", () => {
  it("returns base bonus for neutral polarity slot", () => {
    const aura = createTestMod({
      baseDrain: -4, // Auras have negative drain
      rank: 5,
    })
    // |−4| + 5 = 9
    expect(calculateAuraBonus(aura, undefined)).toBe(9)
  })

  it("doubles bonus for matching polarity", () => {
    const aura = createTestMod({
      baseDrain: -4,
      rank: 5,
      polarity: "madurai" as Polarity,
    })
    // (|−4| + 5) * 2 = 18
    expect(calculateAuraBonus(aura, "madurai")).toBe(18)
  })

  it("halves bonus for mismatched polarity", () => {
    const aura = createTestMod({
      baseDrain: -4,
      rank: 5,
      polarity: "madurai" as Polarity,
    })
    // floor((|−4| + 5) / 2) = 4
    expect(calculateAuraBonus(aura, "vazarin")).toBe(4)
  })

  it("returns base bonus for universal polarity", () => {
    const aura = createTestMod({ baseDrain: -4, rank: 5 })
    expect(calculateAuraBonus(aura, "universal")).toBe(9)
  })

  it("doubles bonus for any polarity slot (non-Umbra)", () => {
    const aura = createTestMod({
      baseDrain: -4,
      rank: 5,
      polarity: "madurai" as Polarity,
    })
    expect(calculateAuraBonus(aura, "any")).toBe(18)
  })

  it("treats any polarity slot as neutral for Umbra auras", () => {
    const aura = createTestMod({
      baseDrain: -4,
      rank: 5,
      polarity: "umbra" as Polarity,
    })
    expect(calculateAuraBonus(aura, "any")).toBe(9)
  })
})

// =============================================================================
// TOTAL CAPACITY TESTS
// =============================================================================

describe("calculateTotalDrain", () => {
  it("returns 0 for empty build", () => {
    const build = createEmptyBuildState()
    expect(calculateTotalDrain(build)).toBe(0)
  })

  it("sums drain from all normal slots", () => {
    const build = createEmptyBuildState()
    const mod = createTestMod({ baseDrain: 4, rank: 5 })

    // Add mod to first two slots
    build.normalSlots[0].mod = mod
    build.normalSlots[1].mod = mod

    // 9 + 9 = 18
    expect(calculateTotalDrain(build)).toBe(18)
  })

  it("includes exilus slot drain", () => {
    const build = createEmptyBuildState()
    const mod = createTestMod({ baseDrain: 2, rank: 3 })

    build.exilusSlot!.mod = mod

    expect(calculateTotalDrain(build)).toBe(5) // 2 + 3
  })

  it("does NOT include aura slot (auras add capacity)", () => {
    const build = createEmptyBuildState()
    build.auraSlots[0].mod = { ...STEEL_CHARGE }

    // Aura should not be counted in drain
    expect(calculateTotalDrain(build)).toBe(0)
  })
})

describe("calculateMaxCapacity", () => {
  it("returns 30 without reactor", () => {
    const build = createEmptyBuildState({ hasReactor: false })
    expect(calculateMaxCapacity(build)).toBe(30)
  })

  it("returns 60 with reactor", () => {
    const build = createEmptyBuildState({ hasReactor: true })
    expect(calculateMaxCapacity(build)).toBe(60)
  })

  it("adds aura bonus to capacity", () => {
    const build = createEmptyBuildState({ hasReactor: true })
    build.auraSlots[0].innatePolarity = "madurai"
    build.auraSlots[0].mod = {
      ...STEEL_CHARGE,
      polarity: "madurai" as Polarity,
    }

    // 60 base + 18 aura (matched) = 78
    expect(calculateMaxCapacity(build)).toBe(78)
  })
})

describe("calculateRemainingCapacity", () => {
  it("returns max capacity for empty build", () => {
    const build = createEmptyBuildState({ hasReactor: true })
    expect(calculateRemainingCapacity(build)).toBe(60)
  })

  it("subtracts mod drain from max capacity", () => {
    const build = createEmptyBuildState({ hasReactor: true })
    const mod = createTestMod({ baseDrain: 4, rank: 6 }) // 10 drain

    build.normalSlots[0].mod = mod

    expect(calculateRemainingCapacity(build)).toBe(50) // 60 - 10
  })

  it("can go negative (over capacity)", () => {
    const build = createEmptyBuildState({ hasReactor: false }) // 30 cap
    const mod = createTestMod({ baseDrain: 10, rank: 10 }) // 20 drain each

    // Add 2 mods = 40 drain
    build.normalSlots[0].mod = mod
    build.normalSlots[1].mod = mod

    expect(calculateRemainingCapacity(build)).toBe(-10) // 30 - 40
  })
})

describe("getCapacityStatus", () => {
  it("returns complete status object", () => {
    const build = createEmptyBuildState({ hasReactor: true })
    const mod = createTestMod({ baseDrain: 4, rank: 5 }) // 9 drain
    build.normalSlots[0].mod = mod

    const status = getCapacityStatus(build)

    expect(status.max).toBe(60)
    expect(status.used).toBe(9)
    expect(status.remaining).toBe(51)
    expect(status.auraBonus).toBe(0)
    expect(status.isOverCapacity).toBe(false)
  })

  it("detects over capacity", () => {
    const build = createEmptyBuildState({ hasReactor: false }) // 30 cap
    const mod = createTestMod({ baseDrain: 10, rank: 10 }) // 20 drain each

    build.normalSlots[0].mod = mod
    build.normalSlots[1].mod = mod

    const status = getCapacityStatus(build)

    expect(status.isOverCapacity).toBe(true)
    expect(status.remaining).toBe(-10)
  })
})

// =============================================================================
// MATCH STATE TESTS
// =============================================================================

describe("getMatchState", () => {
  it('returns "neutral" for no slot polarity', () => {
    expect(getMatchState("madurai", undefined)).toBe("neutral")
  })

  it('returns "neutral" for universal slot polarity', () => {
    expect(getMatchState("madurai", "universal")).toBe("neutral")
  })

  it('returns "match" for any slot polarity (non-Umbra)', () => {
    expect(getMatchState("madurai", "any")).toBe("match")
  })

  it('returns "neutral" for any slot polarity with Umbra mods', () => {
    expect(getMatchState("umbra", "any")).toBe("neutral")
  })

  it('returns "match" for matching polarities', () => {
    expect(getMatchState("vazarin", "vazarin")).toBe("match")
  })

  it('returns "mismatch" for different polarities', () => {
    expect(getMatchState("madurai", "naramon")).toBe("mismatch")
  })
})

describe("wouldMatchPolarity", () => {
  it("returns false for no slot polarity", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMatchPolarity(mod, undefined)).toBe(false)
  })

  it("returns true for matching polarity", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMatchPolarity(mod, "madurai")).toBe(true)
  })

  it("returns false for mismatched polarity", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMatchPolarity(mod, "vazarin")).toBe(false)
  })

  it("returns true for any polarity with non-Umbra mods", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMatchPolarity(mod, "any")).toBe(true)
  })

  it("returns false for any polarity with Umbra mods", () => {
    const mod = createTestMod({ polarity: "umbra" })
    expect(wouldMatchPolarity(mod, "any")).toBe(false)
  })
})

describe("wouldMismatchPolarity", () => {
  it("returns false for no slot polarity", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMismatchPolarity(mod, undefined)).toBe(false)
  })

  it("returns false for matching polarity", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMismatchPolarity(mod, "madurai")).toBe(false)
  })

  it("returns true for mismatched polarity", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMismatchPolarity(mod, "vazarin")).toBe(true)
  })

  it("returns false for any polarity", () => {
    const mod = createTestMod({ polarity: "madurai" })
    expect(wouldMismatchPolarity(mod, "any")).toBe(false)
  })
})

// =============================================================================
// FORMA COUNT TESTS
// =============================================================================

describe("calculateFormaCount", () => {
  it("returns 0 for no forma changes", () => {
    const slots = Array.from({ length: 8 }, (_, i) =>
      createModSlot(`normal-${i}`, "normal"),
    )
    expect(calculateFormaCount(slots, [])).toBe(0)
  })

  it("counts added polarities", () => {
    const slots = [
      { ...createModSlot("0", "normal"), formaPolarity: "madurai" as Polarity },
      createModSlot("1", "normal"),
    ]
    expect(calculateFormaCount(slots, [])).toBe(1)
  })

  it("counts cleared polarities", () => {
    const slots = [
      {
        ...createModSlot("0", "normal", "madurai"),
        formaPolarity: "universal" as Polarity,
      },
    ]
    expect(calculateFormaCount(slots, [])).toBe(1)
  })

  it("counts swapped polarities as free (net 0)", () => {
    // Swapping polarity positions is free in Warframe
    const slots = [
      {
        ...createModSlot("0", "normal", "madurai"),
        formaPolarity: "vazarin" as Polarity,
      },
      {
        ...createModSlot("1", "normal", "vazarin"),
        formaPolarity: "madurai" as Polarity,
      },
    ]
    expect(calculateFormaCount(slots, [])).toBe(0)
  })

  it("counts moved polarity as free (net 0)", () => {
    // Moving a polarity from one slot to another is free
    // e.g., slot 0 had naramon, slot 1 had none -> slot 0 none, slot 1 naramon
    const slots = [
      {
        ...createModSlot("0", "normal", "naramon"),
        formaPolarity: "universal" as Polarity, // clear to none
      },
      {
        ...createModSlot("1", "normal"),
        formaPolarity: "naramon" as Polarity, // add naramon here
      },
    ]
    expect(calculateFormaCount(slots, [])).toBe(0)
  })

  it("handles complex forma scenarios", () => {
    // Innate: [none, none, vazarin] → Desired: [madurai, madurai, none]
    // Optimal: forma vazarin→madurai (1), forma none→madurai (1) = 2
    // The vazarin→madurai change covers both a removal and an addition.
    const slots = [
      { ...createModSlot("0", "normal"), formaPolarity: "madurai" as Polarity },
      { ...createModSlot("1", "normal"), formaPolarity: "madurai" as Polarity },
      {
        ...createModSlot("2", "normal", "vazarin"),
        formaPolarity: "universal" as Polarity,
      },
    ]
    expect(calculateFormaCount(slots, [])).toBe(2)
  })

  it("includes aura and exilus slots", () => {
    const auraSlots: ModSlot[] = [{
      ...createModSlot("aura", "aura", "madurai"),
      formaPolarity: "vazarin" as Polarity,
    }]
    const exilusSlot: ModSlot = {
      ...createModSlot("exilus", "exilus"),
      formaPolarity: "naramon" as Polarity,
    }
    // Aura changed + Exilus gained polarity = 2
    expect(calculateFormaCount([], auraSlots, exilusSlot)).toBe(2)
  })
})

// =============================================================================
// ENDO COST TESTS
// =============================================================================

describe("calculateModEndoCost", () => {
  it("returns 0 for rank 0 mod", () => {
    const mod = createTestMod({ rank: 0, rarity: "Common" })
    expect(calculateModEndoCost(mod)).toBe(0)
  })

  it("calculates endo cost based on rarity and rank", () => {
    const mod = createTestMod({ rank: 5, rarity: "Common" })
    // Common base = 10
    // Ranks 0-4: 10 + 20 + 40 + 80 + 160 = 310
    expect(calculateModEndoCost(mod)).toBe(310)
  })

  it("uses higher base for rare mods", () => {
    const mod = createTestMod({ rank: 3, rarity: "Rare" })
    // Rare base = 20
    // Ranks 0-2: 20 + 40 + 80 = 140
    expect(calculateModEndoCost(mod)).toBe(140)
  })

  it("uses highest base for legendary mods", () => {
    const mod = createTestMod({ rank: 2, rarity: "Legendary" })
    // Legendary base = 30
    // Ranks 0-1: 30 + 60 = 90
    expect(calculateModEndoCost(mod)).toBe(90)
  })
})
