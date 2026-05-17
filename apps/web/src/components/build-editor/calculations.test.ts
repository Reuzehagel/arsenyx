import type { Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { calculateCapacity, type CapacityInput } from "./calculations"
import type { PlacedMod, SlotId } from "./use-build-slots"

// Standard stance mod shape from WFCD data: baseDrain -2, fusionLimit 3.
// At max rank: abs(-2) + 3 = 5, doubled on matching polarity (10),
// scaled 0.75 on mismatch (round(5 * 0.75) = 4).
function stanceMod(polarity: Mod["polarity"]): Mod {
  return {
    uniqueName: `/Stance/${polarity}`,
    name: "Test Stance",
    polarity,
    rarity: "Uncommon",
    baseDrain: -2,
    fusionLimit: 3,
    type: "Stance Mod",
    compatName: "Polearms",
    tradable: true,
  }
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

function placedStance(polarity: Mod["polarity"]): PlacedMod {
  return { mod: stanceMod(polarity), rank: 3 }
}

describe("calculateCapacity", () => {
  it("base capacity is level * 2 with reactor, level otherwise", () => {
    expect(calculateCapacity(emptyInput()).max).toBe(60)
    expect(calculateCapacity(emptyInput({ hasReactor: false })).max).toBe(30)
  })

  it("stance with no innate / universal slot grants +5", () => {
    const placed: Partial<Record<SlotId, PlacedMod>> = {
      stance: placedStance("naramon"),
    }
    const result = calculateCapacity(emptyInput({ placed }))
    expect(result.max).toBe(65) // 60 + 5
  })

  it("stance with matching innate polarity grants +10", () => {
    const placed: Partial<Record<SlotId, PlacedMod>> = {
      stance: placedStance("naramon"),
    }
    const result = calculateCapacity(
      emptyInput({ placed, stanceInnate: "naramon" }),
    )
    expect(result.max).toBe(70) // 60 + 10
  })

  it("stance with mismatched innate polarity grants +4", () => {
    const placed: Partial<Record<SlotId, PlacedMod>> = {
      stance: placedStance("naramon"),
    }
    const result = calculateCapacity(
      emptyInput({ placed, stanceInnate: "madurai" }),
    )
    expect(result.max).toBe(64) // 60 + 4
  })

  it("matching forma on a non-matching slot still grants +10", () => {
    const placed: Partial<Record<SlotId, PlacedMod>> = {
      stance: placedStance("naramon"),
    }
    const result = calculateCapacity(
      emptyInput({
        placed,
        stanceInnate: "madurai",
        formaPolarities: { stance: "naramon" },
      }),
    )
    expect(result.max).toBe(70)
  })

  it("universal forma on a polarized slot clears the bonus down to +5", () => {
    const placed: Partial<Record<SlotId, PlacedMod>> = {
      stance: placedStance("naramon"),
    }
    const result = calculateCapacity(
      emptyInput({
        placed,
        stanceInnate: "naramon",
        formaPolarities: { stance: "universal" },
      }),
    )
    expect(result.max).toBe(65)
  })

  it("no stance placed → no bonus", () => {
    expect(calculateCapacity(emptyInput()).max).toBe(60)
  })
})
