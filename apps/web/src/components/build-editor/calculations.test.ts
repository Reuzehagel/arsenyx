import type { Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import {
  auraBonusForMod,
  calculateCapacity,
  calculateFormaCount,
  type CapacityInput,
  getMatchState,
} from "./calculations"
import type { PlacedMod, SlotId } from "./use-build-slots"

// Standard stance mod shape from the mod data: baseDrain -2, fusionLimit 3.
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
    type: "Stance",
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

  it("a locked exalted stance grants +10 without anything in `placed`", () => {
    // Exalted melees ship a fixed Zenurik stance that lives outside `placed`.
    const result = calculateCapacity(
      emptyInput({
        lockedStance: placedStance("zenurik"),
        stanceInnate: "zenurik",
      }),
    )
    expect(result.max).toBe(70) // 60 + 10
    expect(result.used).toBe(0) // the stance is a bonus, not a cost
  })

  it("a locked stance takes precedence over any placed stance", () => {
    const result = calculateCapacity(
      emptyInput({
        placed: { stance: placedStance("naramon") },
        lockedStance: placedStance("zenurik"),
        stanceInnate: "zenurik",
      }),
    )
    expect(result.max).toBe(70)
  })

  it("a locked stance ignores stray stance forma (slot can't be forma'd)", () => {
    // A crafted share URL could carry formaPolarities.stance; it must not
    // degrade the locked stance's guaranteed +10 (the slot is read-only).
    const result = calculateCapacity(
      emptyInput({
        lockedStance: placedStance("zenurik"),
        stanceInnate: "zenurik",
        formaPolarities: { stance: "madurai" },
      }),
    )
    expect(result.max).toBe(70)
  })
})

// Regression: issue #168 — an "any" (Universal) polarity aura, e.g. Dreamer's
// Bond (baseDrain -2 → +7 at max rank), must earn the doubled bonus on every
// polarized slot, not only on an "any"-polarity slot.
describe('"any"-polarity mods match every polarized slot', () => {
  function placedAura(polarity: Mod["polarity"]): PlacedMod {
    return {
      mod: {
        uniqueName: "/Aura/any",
        name: "Dreamer's Bond",
        polarity,
        rarity: "Uncommon",
        baseDrain: -2,
        fusionLimit: 5,
        type: "Aura",
        compatName: "AURA",
        tradable: true,
      },
      rank: 5,
    }
  }

  it("getMatchState treats an any-polarity mod as matching any slot", () => {
    expect(getMatchState("any", "madurai")).toBe("match")
    expect(getMatchState("any", "any")).toBe("match")
    expect(getMatchState("any", undefined)).toBe("neutral")
  })

  it("auraBonusForMod doubles an any-polarity aura on a specific slot", () => {
    expect(auraBonusForMod(placedAura("any").mod, 5, "madurai")).toBe(14)
    expect(auraBonusForMod(placedAura("any").mod, 5, "any")).toBe(14)
    expect(auraBonusForMod(placedAura("any").mod, 5, undefined)).toBe(7)
  })

  it("an any-polarity aura grants +14 on a madurai aura slot", () => {
    const result = calculateCapacity(
      emptyInput({
        placed: { "aura-0": placedAura("any") },
        auraInnates: ["madurai"],
      }),
    )
    expect(result.max).toBe(74) // 60 + 14
  })
})

// Regression: forma must dedup within a slot type, never across types. A
// forma'd Aura previously shared the normal pool and could cancel a
// same-polarity normal forma, undercounting vs Overframe (matches OF here).
describe("calculateFormaCount", () => {
  const NO_NORMALS = Array<undefined>(8).fill(undefined)

  it("does not let a forma'd aura offset a same-polarity normal forma", () => {
    // Valkyr Prime (aura madurai + 3 madurai normals). Aura forma'd madurai→any,
    // two blank normals forma'd to madurai, plus umbra/zenurik/vazarin. OF = 5.
    const count = calculateFormaCount({
      auraInnates: ["madurai"],
      normalInnates: [
        "madurai",
        "madurai",
        "madurai",
        ...Array(5).fill(undefined),
      ],
      formaPolarities: {
        "aura-0": "any",
        "normal-2": "umbra",
        "normal-3": "zenurik",
        "normal-4": "madurai",
        "normal-5": "vazarin",
        "normal-6": "madurai",
      },
    })
    expect(count).toBe(5)
  })

  it("dedups a polarity move within the interchangeable normal pool", () => {
    // Sarofang Prime (1 innate naramon normal, stance madurai). naramon moved
    // off slot 0 and onto slot 2 is 1 net forma; stance mod matches innate. OF = 5.
    const count = calculateFormaCount({
      auraInnates: [],
      stanceInnate: "madurai",
      normalInnates: ["naramon", ...Array(7).fill(undefined)],
      formaPolarities: {
        "normal-0": "madurai",
        "normal-1": "madurai",
        "normal-2": "naramon",
        "normal-3": "madurai",
        "normal-4": "madurai",
        "normal-6": "madurai",
      },
    })
    expect(count).toBe(5)
  })

  it("scores a forma'd exilus separately from the normal pool", () => {
    const count = calculateFormaCount({
      auraInnates: [],
      exilusInnate: "madurai",
      normalInnates: NO_NORMALS,
      formaPolarities: { exilus: "vazarin", "normal-0": "madurai" },
    })
    expect(count).toBe(2)
  })
})
