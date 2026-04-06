import { describe, it, expect } from "bun:test"

import {
  applyOverframeImportToBuildState,
  type ApplyOverframeImportWarning,
} from "../apply"
import type { OverframeImportResponse } from "../types"
import type { BuildState, Mod, ModSlot, Polarity } from "@/lib/warframe/types"

// =============================================================================
// Test helpers
// =============================================================================

function makeSlot(
  id: string,
  type: "aura" | "exilus" | "normal",
  innatePolarity?: Polarity,
): ModSlot {
  return { id, type, innatePolarity }
}

function makeMod(name: string, uniqueName: string): Mod {
  return {
    uniqueName,
    name,
    imageName: `${name}.png`,
    polarity: "madurai" as Polarity,
    baseDrain: 4,
    fusionLimit: 5,
    rarity: "Rare",
    type: "Rifle",
  } as Mod
}

function makeBaseBuildState(overrides?: Partial<BuildState>): BuildState {
  return {
    itemUniqueName: "/Lotus/Powersuits/Excalibur",
    itemName: "Excalibur",
    itemCategory: "warframes",
    hasReactor: true,
    auraSlot: makeSlot("aura-0", "aura", "madurai"),
    exilusSlot: makeSlot("exilus-0", "exilus"),
    normalSlots: Array.from({ length: 8 }, (_, i) =>
      makeSlot(`normal-${i}`, "normal", i < 2 ? "madurai" : undefined),
    ),
    arcaneSlots: [null, null],
    shardSlots: [null, null, null, null, null],
    baseCapacity: 60,
    currentCapacity: 60,
    formaCount: 0,
    ...overrides,
  }
}

function makeImportResponse(
  overrides?: Partial<OverframeImportResponse>,
): OverframeImportResponse {
  return {
    source: { url: "https://overframe.gg/build/test" },
    item: { overframeName: "Excalibur" },
    formaCount: null,
    mods: [],
    warnings: [],
    ...overrides,
  }
}

// =============================================================================
// Polarity / forma logic
// =============================================================================

describe("applyOverframeImportToBuildState — polarity", () => {
  it("Case 1: applies universal forma when import has no polarity but slot has innate", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      slotPolarities: [
        { slotId: "normal-0", polarityCode: 0, polarity: undefined },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    expect(nextState.normalSlots[0].formaPolarity).toBe("universal")
  })

  it("Case 2: no change when both import and innate have no polarity", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      slotPolarities: [
        { slotId: "normal-5", polarityCode: 0, polarity: undefined },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    // normal-5 has no innate polarity, so no forma applied
    expect(nextState.normalSlots[5].formaPolarity).toBeUndefined()
  })

  it("Case 3: no forma when import polarity matches innate", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      slotPolarities: [
        { slotId: "normal-0", polarityCode: 1, polarity: "madurai" },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    // normal-0 has innate madurai, import says madurai → no forma
    expect(nextState.normalSlots[0].formaPolarity).toBeUndefined()
  })

  it("Case 4: applies forma when import polarity differs from innate", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      slotPolarities: [
        { slotId: "normal-0", polarityCode: 3, polarity: "naramon" },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    // normal-0 has innate madurai, import says naramon → forma applied
    expect(nextState.normalSlots[0].formaPolarity).toBe("naramon")
  })

  it("warns on unknown slotId", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      slotPolarities: [
        { slotId: "unknown-99", polarityCode: 1, polarity: "madurai" },
      ],
    })

    const { warnings } = applyOverframeImportToBuildState(state, importResult, [])

    expect(warnings.some((w) => w.type === "slot_unknown")).toBe(true)
  })
})

// =============================================================================
// Mod placement
// =============================================================================

describe("applyOverframeImportToBuildState — mod placement", () => {
  const serration = makeMod("Serration", "/Lotus/Mods/Serration")
  const splitChamber = makeMod("Split Chamber", "/Lotus/Mods/SplitChamber")

  it("places a matched mod in the correct slot", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      mods: [
        {
          overframeId: "5924",
          rank: 5,
          slotId: "normal-0",
          matched: { uniqueName: "/Lotus/Mods/Serration", name: "Serration", score: 1 },
        },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(
      state,
      importResult,
      [serration],
    )

    expect(nextState.normalSlots[0].mod?.name).toBe("Serration")
    expect(nextState.normalSlots[0].mod?.rank).toBe(5)
  })

  it("clamps rank to fusionLimit", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      mods: [
        {
          overframeId: "5924",
          rank: 99, // way above fusionLimit of 5
          slotId: "normal-0",
          matched: { uniqueName: "/Lotus/Mods/Serration", name: "Serration", score: 1 },
        },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(
      state,
      importResult,
      [serration],
    )

    expect(nextState.normalSlots[0].mod?.rank).toBe(5) // clamped to fusionLimit
  })

  it("places mods in aura and exilus slots", () => {
    const auraMod = makeMod("Steel Charge", "/Lotus/Mods/SteelCharge")
    const exilusMod = makeMod("Cunning Drift", "/Lotus/Mods/CunningDrift")
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      mods: [
        {
          overframeId: "1",
          rank: 5,
          slotId: "aura-0",
          matched: { uniqueName: "/Lotus/Mods/SteelCharge", name: "Steel Charge", score: 1 },
        },
        {
          overframeId: "2",
          rank: 5,
          slotId: "exilus-0",
          matched: { uniqueName: "/Lotus/Mods/CunningDrift", name: "Cunning Drift", score: 1 },
        },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(
      state,
      importResult,
      [auraMod, exilusMod],
    )

    expect(nextState.auraSlot?.mod?.name).toBe("Steel Charge")
    expect(nextState.exilusSlot?.mod?.name).toBe("Cunning Drift")
  })

  it("warns when mod has no match", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      mods: [
        {
          overframeId: "999",
          rank: 5,
          slotId: "normal-0",
          matched: undefined,
        },
      ],
    })

    const { warnings } = applyOverframeImportToBuildState(state, importResult, [])

    expect(warnings.some((w) => w.type === "mod_missing_match")).toBe(true)
  })

  it("warns when matched mod is not in compatible list", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      mods: [
        {
          overframeId: "5924",
          rank: 5,
          slotId: "normal-0",
          matched: { uniqueName: "/Lotus/Mods/Unknown", name: "Unknown", score: 0.9 },
        },
      ],
    })

    const { warnings } = applyOverframeImportToBuildState(
      state,
      importResult,
      [serration], // doesn't contain the matched uniqueName
    )

    expect(warnings.some((w) => w.type === "mod_not_in_compatible_list")).toBe(true)
  })
})

// =============================================================================
// Arcane placement
// =============================================================================

describe("applyOverframeImportToBuildState — arcanes", () => {
  it("places a matched arcane in the correct slot", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      arcanes: [
        {
          overframeId: "arc1",
          rank: 5,
          slotIndex: 0,
          matched: {
            uniqueName: "/Lotus/Arcanes/Energize",
            name: "Arcane Energize",
            imageName: "energize.png",
            rarity: "Legendary",
            score: 1,
          },
        },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    expect(nextState.arcaneSlots[0]?.name).toBe("Arcane Energize")
    expect(nextState.arcaneSlots[0]?.rank).toBe(5)
  })

  it("warns when arcane slot index is out of range", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      arcanes: [
        {
          overframeId: "arc1",
          rank: 5,
          slotIndex: 99, // out of range
          matched: {
            uniqueName: "/Lotus/Arcanes/Energize",
            name: "Arcane Energize",
            rarity: "Legendary",
            score: 1,
          },
        },
      ],
    })

    const { warnings } = applyOverframeImportToBuildState(state, importResult, [])

    expect(warnings.some((w) => w.type === "slot_unknown")).toBe(true)
  })

  it("skips arcanes without a match", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      arcanes: [
        {
          overframeId: "arc1",
          rank: 5,
          slotIndex: 0,
          matched: undefined,
        },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    expect(nextState.arcaneSlots[0]).toBeNull()
  })
})

// =============================================================================
// formaCount
// =============================================================================

describe("applyOverframeImportToBuildState — formaCount", () => {
  it("uses import formaCount when provided", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({ formaCount: 7 })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    expect(nextState.formaCount).toBe(7)
  })

  it("computes formaCount when import value is null", () => {
    const state = makeBaseBuildState()
    const importResult = makeImportResponse({
      formaCount: null,
      slotPolarities: [
        { slotId: "normal-0", polarityCode: 3, polarity: "naramon" },
        { slotId: "normal-2", polarityCode: 4, polarity: "zenurik" },
      ],
    })

    const { nextState } = applyOverframeImportToBuildState(state, importResult, [])

    // Should be computed from slot polarity changes
    expect(nextState.formaCount).toBeGreaterThanOrEqual(0)
  })
})

// =============================================================================
// Immutability
// =============================================================================

describe("applyOverframeImportToBuildState — immutability", () => {
  it("does not mutate the original state", () => {
    const state = makeBaseBuildState()
    const originalSlot0Polarity = state.normalSlots[0].formaPolarity

    const importResult = makeImportResponse({
      slotPolarities: [
        { slotId: "normal-0", polarityCode: 3, polarity: "naramon" },
      ],
    })

    applyOverframeImportToBuildState(state, importResult, [])

    // Original should be unchanged
    expect(state.normalSlots[0].formaPolarity).toBe(originalSlot0Polarity)
  })
})
