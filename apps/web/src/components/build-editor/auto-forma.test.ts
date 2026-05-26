import type { Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { computeAutoFormaPlan } from "./auto-forma"
import { calculateCapacity, type CapacityInput } from "./calculations"
import type { PlacedMod, SlotId } from "./use-build-slots"

function mod(polarity: Mod["polarity"], baseDrain: number, name = "Test"): Mod {
  return {
    uniqueName: `/Mod/${name}`,
    name,
    polarity,
    rarity: "Common",
    baseDrain,
    fusionLimit: 0,
    type: "Mod",
    tradable: true,
  }
}

function placed(polarity: Mod["polarity"], baseDrain: number): PlacedMod {
  return { mod: mod(polarity, baseDrain), rank: 0 }
}

function emptyInput(overrides: Partial<CapacityInput> = {}): CapacityInput {
  return {
    placed: {},
    formaPolarities: {},
    auraInnates: [],
    normalInnates: Array.from({ length: 8 }, () => undefined),
    hasReactor: true,
    ...overrides,
  }
}

describe("computeAutoFormaPlan", () => {
  it("returns empty when already within capacity", () => {
    const input = emptyInput({
      placed: { "normal-0": placed("madurai", 10) },
    })
    expect(computeAutoFormaPlan(input)).toEqual([])
  })

  it("formas mismatched slots until capacity fits, top-down", () => {
    // 5 mods, 10 drain each → used = 50, max = 60 (fits). Drop reactor →
    // max = 30, used = 50. Each forma halves a slot to 5, so two formas
    // (50 → 45 → 40 → ... actually 50 − 5 = 45, − 5 = 40, − 5 = 35, − 5 = 30):
    // 4 formas should bring it to 30 ≤ 30.
    const placedMap: Partial<Record<SlotId, PlacedMod>> = {}
    for (let i = 0; i < 5; i++) {
      placedMap[`normal-${i}` as SlotId] = placed("madurai", 10)
    }
    const input = emptyInput({ placed: placedMap, hasReactor: false })
    const plan = computeAutoFormaPlan(input)
    const next = {
      ...input,
      formaPolarities: Object.fromEntries(
        plan.map((s) => [s.id, s.polarity]),
      ),
    }
    const finalCap = calculateCapacity(next)
    expect(finalCap.used).toBeLessThanOrEqual(finalCap.max)
    for (const step of plan) {
      expect(step.polarity).toBe("madurai")
    }
  })

  it("stops when remaining formas can't close the gap", () => {
    // 8 × 16-drain madurai mods, no reactor (max = 30). Even formaing every
    // slot leaves used = 8 × 8 = 64 > 30. Plan should still apply all 8
    // (each forma is a positive gain) but final capacity stays over.
    const placedMap: Partial<Record<SlotId, PlacedMod>> = {}
    for (let i = 0; i < 8; i++) {
      placedMap[`normal-${i}` as SlotId] = placed("madurai", 16)
    }
    const input = emptyInput({ placed: placedMap, hasReactor: false })
    const plan = computeAutoFormaPlan(input)
    expect(plan).toHaveLength(8)
  })

  it("skips slots whose innate polarity already matches the mod", () => {
    // Slot 0 is madurai-innate so adding a madurai mod is already optimized.
    // Slot 1 has no innate; that's where the forma should go.
    const placedMap: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("madurai", 16),
      "normal-1": placed("madurai", 16),
    }
    const innates = Array.from({ length: 8 }, () => undefined) as (
      | Mod["polarity"]
      | undefined
    )[]
    innates[0] = "madurai"
    const input = emptyInput({
      placed: placedMap,
      normalInnates: innates,
      hasReactor: false, // tighter capacity to force a forma
    })
    const plan = computeAutoFormaPlan(input)
    // normal-0 should never appear — its effective polarity already matches.
    expect(plan.find((s) => s.id === "normal-0")).toBeUndefined()
  })

  it("stops when no further forma improves capacity", () => {
    // Single mod, way over an unfixable cap.
    const input = emptyInput({
      placed: { "normal-0": placed("madurai", 16) },
      hasReactor: false,
      // Strip every normal slot to a single one to keep the search small.
      normalInnates: [undefined],
    })
    // With only one slot and capacity 30, drain 16 → already fits. Force
    // over-capacity with a tiny maxLevelCap.
    const tight = { ...input, maxLevelCap: 8 } // max = 8, used = 16
    const plan = computeAutoFormaPlan(tight)
    // One forma halves drain to 8 → exactly fits.
    expect(plan).toHaveLength(1)
    expect(plan[0]).toEqual({ id: "normal-0", polarity: "madurai" })
  })
})
