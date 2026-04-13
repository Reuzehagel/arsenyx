import { describe, it, expect } from "bun:test"

import { calculateWarframeStats } from "../stats/warframe-stats"
import type { BuildState, Warframe, ModSlot, PlacedMod } from "../types"

// =============================================================================
// Test helpers
// =============================================================================

function makeSlot(id: string, mod?: PlacedMod): ModSlot {
  return { id, type: "normal", mod }
}

function makePlacedMod(
  name: string,
  levelStats: Array<{ stats: string[] }>,
): PlacedMod {
  return {
    uniqueName: `/Lotus/Mods/${name.replace(/\s/g, "")}`,
    name,
    polarity: "madurai",
    baseDrain: 4,
    fusionLimit: 10,
    rank: 10,
    rarity: "Rare",
    levelStats,
  }
}

function makeEmptyBuildState(overrides?: Partial<BuildState>): BuildState {
  return {
    itemUniqueName: "/Lotus/Powersuits/Test",
    itemName: "Test Frame",
    itemCategory: "warframes",
    hasReactor: true,
    auraSlots: [{ id: "aura-0", type: "aura" }],
    exilusSlot: { id: "exilus-0", type: "exilus" },
    normalSlots: Array.from({ length: 8 }, (_, i) => makeSlot(`normal-${i}`)),
    arcaneSlots: [null, null],
    shardSlots: [null, null, null, null, null],
    baseCapacity: 60,
    currentCapacity: 60,
    formaCount: 0,
    ...overrides,
  }
}

function makeWarframe(overrides?: Partial<Warframe>): Warframe {
  return {
    uniqueName: "/Lotus/Powersuits/Test",
    name: "TestFrame",
    imageName: "test.png",
    category: "Warframes",
    masteryReq: 0,
    health: 100,
    shield: 100,
    armor: 150,
    power: 100,
    sprintSpeed: 1.0,
    ...overrides,
  } as Warframe
}

// =============================================================================
// Rank-up bonuses
// =============================================================================

describe("calculateWarframeStats — rank-up bonuses", () => {
  it("applies default rank-up bonus (+100 HP, +100 shield, +50 energy)", () => {
    const frame = makeWarframe({ health: 100, shield: 100, armor: 150, power: 100 })
    const state = makeEmptyBuildState()
    const result = calculateWarframeStats(frame, state)

    // Base + rank30 bonus: 100+100=200 HP, 100+100=200 shield, 150+0=150 armor, 100+50=150 energy
    expect(result.health.base).toBe(200)
    expect(result.shield.base).toBe(200)
    expect(result.armor.base).toBe(150)
    expect(result.energy.base).toBe(150)
  })

  it("applies Inaros exception (+200 HP, 0 shield, +50 energy)", () => {
    const inaros = makeWarframe({
      name: "Inaros",
      health: 550,
      shield: 0,
      armor: 200,
      power: 100,
    })
    const state = makeEmptyBuildState()
    const result = calculateWarframeStats(inaros, state)

    // 550+200=750 HP, 0+0=0 shield, 200+0=200 armor, 100+50=150 energy
    expect(result.health.base).toBe(750)
    expect(result.shield.base).toBe(0)
  })

  it("applies Hildryn exception (+500 shield, 0 energy)", () => {
    const hildryn = makeWarframe({
      name: "Hildryn",
      health: 75,
      shield: 450,
      armor: 300,
      power: 0,
    })
    const state = makeEmptyBuildState()
    const result = calculateWarframeStats(hildryn, state)

    // 75+100=175 HP, 450+500=950 shield, 0+0 energy
    expect(result.health.base).toBe(175)
    expect(result.shield.base).toBe(950)
    expect(result.energy.base).toBe(0)
  })

  it("skips rank-up bonus when skipRankUpBonus is true", () => {
    const frame = makeWarframe({ health: 200, shield: 200, armor: 100, power: 150 })
    const state = makeEmptyBuildState()
    const result = calculateWarframeStats(frame, state, false, {
      skipRankUpBonus: true,
    })

    // Should use raw WFCD values without adding rank-up
    expect(result.health.base).toBe(200)
    expect(result.shield.base).toBe(200)
    expect(result.armor.base).toBe(100)
    expect(result.energy.base).toBe(150)
  })
})

// =============================================================================
// Mod effects
// =============================================================================

describe("calculateWarframeStats — mods", () => {
  it("applies percentage health mod (Vitality +440%)", () => {
    const frame = makeWarframe({ health: 100 }) // rank30: 200
    const vitality = makePlacedMod("Vitality", [{ stats: ["+440% Health"] }])
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", vitality),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(`normal-${i + 1}`)),
      ],
    })
    const result = calculateWarframeStats(frame, state)

    // 200 * (1 + 4.4) = 200 * 5.4 = 1080
    expect(result.health.modified).toBe(1080)
  })

  it("applies percentage armor mod (Steel Fiber +110%)", () => {
    const frame = makeWarframe({ armor: 150 }) // rank30: 150 (no rank-up for armor)
    const steelFiber = makePlacedMod("Steel Fiber", [{ stats: ["+110% Armor"] }])
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", steelFiber),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(`normal-${i + 1}`)),
      ],
    })
    const result = calculateWarframeStats(frame, state)

    // 150 * (1 + 1.1) = 150 * 2.1 = 315
    expect(result.armor.modified).toBe(315)
  })
})

// =============================================================================
// Umbral set bonus
// =============================================================================

describe("calculateWarframeStats — Umbral set bonus", () => {
  const umbralVitality = makePlacedMod("Umbral Vitality", [
    { stats: ["+440% Health"] },
  ])
  const umbralFiber = makePlacedMod("Umbral Fiber", [
    { stats: ["+110% Armor"] },
  ])
  const umbralIntensify = makePlacedMod("Umbral Intensify", [
    { stats: ["+44% Ability Strength"] },
  ])

  it("applies no bonus with 1 Umbral mod (1.0x)", () => {
    const frame = makeWarframe({ health: 100 }) // rank30: 200
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", umbralVitality),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(`normal-${i + 1}`)),
      ],
    })
    const result = calculateWarframeStats(frame, state)

    // 200 * (1 + 4.4 * 1.0) = 200 * 5.4 = 1080 — same as regular Vitality
    expect(result.health.modified).toBe(1080)
  })

  it("applies 1.25x bonus with 2 Umbral mods", () => {
    const frame = makeWarframe({ health: 100, armor: 150 })
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", umbralVitality),
        makeSlot("normal-1", umbralFiber),
        ...Array.from({ length: 6 }, (_, i) => makeSlot(`normal-${i + 2}`)),
      ],
    })
    const result = calculateWarframeStats(frame, state)

    // Health: 200 * (1 + 4.4 * 1.25) = 200 * (1 + 5.5) = 200 * 6.5 = 1300
    expect(result.health.modified).toBe(1300)
    // Armor: 150 * (1 + 1.1 * 1.25) = 150 * (1 + 1.375) = 150 * 2.375 = 356.25
    expect(result.armor.modified).toBe(356.25)
  })

  it("applies 1.75x bonus with 3 Umbral mods", () => {
    const frame = makeWarframe({ health: 100, armor: 150 })
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", umbralVitality),
        makeSlot("normal-1", umbralFiber),
        makeSlot("normal-2", umbralIntensify),
        ...Array.from({ length: 5 }, (_, i) => makeSlot(`normal-${i + 3}`)),
      ],
    })
    const result = calculateWarframeStats(frame, state)

    // Health: 200 * (1 + 4.4 * 1.75) = 200 * (1 + 7.7) = 200 * 8.7 = 1740
    expect(result.health.modified).toBe(1740)
    // Armor: 150 * (1 + 1.1 * 1.75) = 150 * (1 + 1.925) = 150 * 2.925 = 438.75
    expect(result.armor.modified).toBe(438.75)
  })
})

// =============================================================================
// Ability stats
// =============================================================================

describe("calculateWarframeStats — ability stats", () => {
  it("returns 100% base for all ability stats with no mods", () => {
    const frame = makeWarframe()
    const state = makeEmptyBuildState()
    const result = calculateWarframeStats(frame, state)

    expect(result.abilityStrength.base).toBe(100)
    expect(result.abilityStrength.modified).toBe(100)
    expect(result.abilityDuration.base).toBe(100)
    expect(result.abilityEfficiency.base).toBe(100)
    expect(result.abilityRange.base).toBe(100)
  })

  it("applies ability strength mod (Intensify +30%)", () => {
    const frame = makeWarframe()
    const intensify = makePlacedMod("Intensify", [
      { stats: ["+30% Ability Strength"] },
    ])
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", intensify),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(`normal-${i + 1}`)),
      ],
    })
    const result = calculateWarframeStats(frame, state)

    // 100 + 30 = 130%
    expect(result.abilityStrength.modified).toBe(130)
  })

  it("caps ability efficiency at 175%", () => {
    const frame = makeWarframe()
    const fleeting = makePlacedMod("Fleeting Expertise", [
      { stats: ["+60% Ability Efficiency", "-60% Ability Duration"] },
    ])
    const streamline = makePlacedMod("Streamline", [
      { stats: ["+30% Ability Efficiency"] },
    ])
    // Another efficiency mod to push past cap
    const extraEff = makePlacedMod("Extra Efficiency", [
      { stats: ["+90% Ability Efficiency"] },
    ])
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", fleeting),
        makeSlot("normal-1", streamline),
        makeSlot("normal-2", extraEff),
        ...Array.from({ length: 5 }, (_, i) => makeSlot(`normal-${i + 3}`)),
      ],
    })
    const result = calculateWarframeStats(frame, state)

    // 100 + 60 + 30 + 90 = 280 → capped at 175
    expect(result.abilityEfficiency.modified).toBe(175)
  })
})

// =============================================================================
// Sprint speed
// =============================================================================

describe("calculateWarframeStats — sprint speed", () => {
  it("uses warframe sprintSpeed as base", () => {
    const frame = makeWarframe({ sprintSpeed: 1.2 })
    const state = makeEmptyBuildState()
    const result = calculateWarframeStats(frame, state)

    expect(result.sprintSpeed.base).toBe(1.2)
    expect(result.sprintSpeed.modified).toBe(1.2)
  })

  it("defaults to 1.0 when sprintSpeed is undefined", () => {
    const frame = makeWarframe({ sprintSpeed: undefined })
    const state = makeEmptyBuildState()
    const result = calculateWarframeStats(frame, state)

    expect(result.sprintSpeed.base).toBe(1.0)
  })
})
