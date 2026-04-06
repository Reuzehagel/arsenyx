import { describe, it, expect } from "bun:test"

import { calculateWeaponStats } from "../stats/weapon-stats"
import type { BuildState, Gun, Melee, ModSlot, PlacedMod } from "../types"

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
    fusionLimit: 5,
    rank: 5,
    rarity: "Rare",
    levelStats,
  }
}

function makeEmptyBuildState(overrides?: Partial<BuildState>): BuildState {
  return {
    itemUniqueName: "/Lotus/Weapons/Test",
    itemName: "Test Weapon",
    itemCategory: "primary",
    hasReactor: false,
    normalSlots: Array.from({ length: 8 }, (_, i) => makeSlot(`normal-${i}`)),
    arcaneSlots: [null],
    shardSlots: [],
    baseCapacity: 30,
    currentCapacity: 30,
    formaCount: 0,
    ...overrides,
  }
}

function makeGun(overrides?: Partial<Gun>): Gun {
  return {
    uniqueName: "/Lotus/Weapons/TestGun",
    name: "Test Gun",
    imageName: "test.png",
    category: "Primary",
    masteryReq: 0,
    totalDamage: 100,
    fireRate: 5,
    criticalChance: 0.3, // 30%
    criticalMultiplier: 2.0,
    procChance: 0.2, // 20%
    damage: {
      impact: 30,
      puncture: 40,
      slash: 30,
    },
    magazineSize: 30,
    reloadTime: 2.0,
    ...overrides,
  } as Gun
}

function makeMelee(overrides?: Partial<Melee>): Melee {
  return {
    uniqueName: "/Lotus/Weapons/TestMelee",
    name: "Test Melee",
    imageName: "test.png",
    category: "Melee",
    masteryReq: 0,
    totalDamage: 150,
    fireRate: 1.0,
    criticalChance: 0.25,
    criticalMultiplier: 2.0,
    procChance: 0.2,
    damage: {
      impact: 50,
      puncture: 50,
      slash: 50,
    },
    range: 2.5,
    ...overrides,
  } as Melee
}

// =============================================================================
// Basic stats (no mods)
// =============================================================================

describe("calculateWeaponStats — no mods", () => {
  it("returns base stats unmodified", () => {
    const gun = makeGun()
    const state = makeEmptyBuildState()
    const result = calculateWeaponStats(gun, state)

    expect(result.attackModes).toHaveLength(1)
    const mode = result.attackModes[0]
    expect(mode.name).toBe("Normal Attack")
    expect(mode.totalDamage.base).toBe(100)
    expect(mode.totalDamage.modified).toBe(100)
    // criticalChance: 0.3 * 100 = 30
    expect(mode.criticalChance.base).toBe(30)
    expect(mode.criticalChance.modified).toBe(30)
    expect(mode.criticalMultiplier.base).toBe(2.0)
    expect(mode.fireRate.base).toBe(5)
  })

  it("includes gun-specific stats (magazine, reload)", () => {
    const gun = makeGun()
    const state = makeEmptyBuildState()
    const result = calculateWeaponStats(gun, state)
    const mode = result.attackModes[0]

    expect(mode.magazineSize?.base).toBe(30)
    expect(mode.reloadTime?.base).toBe(2.0)
  })

  it("includes melee-specific stats (range)", () => {
    const melee = makeMelee()
    const state = makeEmptyBuildState()
    const result = calculateWeaponStats(melee, state)
    const mode = result.attackModes[0]

    expect(mode.range?.base).toBe(2.5)
  })
})

// =============================================================================
// Damage mods
// =============================================================================

describe("calculateWeaponStats — damage mods", () => {
  it("applies base damage mod (Serration +165%)", () => {
    const gun = makeGun({ totalDamage: 100 })
    const serration = makePlacedMod("Serration", [
      { stats: ["+165% Damage"] },
    ])
    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", serration),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(`normal-${i + 1}`)),
      ],
    })

    const result = calculateWeaponStats(gun, state)
    const mode = result.attackModes[0]

    // 100 * (1 + 1.65) = 265
    expect(mode.totalDamage.modified).toBe(265)
  })
})

// =============================================================================
// Damage breakdown / elemental combination
// =============================================================================

describe("calculateWeaponStats — elemental combination", () => {
  it("produces combined element from two base elements (heat + cold = blast)", () => {
    const gun = makeGun({
      totalDamage: 100,
      damage: { impact: 50, puncture: 50 },
    })
    const heatMod = makePlacedMod("Hellfire", [{ stats: ["+90% <DT_FIRE_COLOR>Heat"] }])
    const coldMod = makePlacedMod("Cryo Rounds", [{ stats: ["+90% <DT_COLD_COLOR>Cold"] }])

    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", heatMod),
        makeSlot("normal-1", coldMod),
        ...Array.from({ length: 6 }, (_, i) => makeSlot(`normal-${i + 2}`)),
      ],
    })

    const result = calculateWeaponStats(gun, state)
    const breakdown = result.attackModes[0].damageBreakdown

    // Should have blast (heat + cold combined)
    const blast = breakdown.elemental.find((e) => e.type === "blast")
    expect(blast).toBeDefined()
    expect(blast!.value).toBeGreaterThan(0)

    // Should NOT have separate heat or cold
    const heat = breakdown.elemental.find((e) => e.type === "heat")
    const cold = breakdown.elemental.find((e) => e.type === "cold")
    expect(heat).toBeUndefined()
    expect(cold).toBeUndefined()
  })

  it("leaves uncombined element when odd number of base elements", () => {
    const gun = makeGun({
      totalDamage: 100,
      damage: { impact: 100 },
    })
    const heatMod = makePlacedMod("Hellfire", [{ stats: ["+90% <DT_FIRE_COLOR>Heat"] }])
    const coldMod = makePlacedMod("Cryo Rounds", [{ stats: ["+90% <DT_COLD_COLOR>Cold"] }])
    const toxinMod = makePlacedMod("Infected Clip", [
      { stats: ["+90% <DT_TOXIN_COLOR>Toxin"] },
    ])

    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", heatMod),
        makeSlot("normal-1", coldMod),
        makeSlot("normal-2", toxinMod),
        ...Array.from({ length: 5 }, (_, i) => makeSlot(`normal-${i + 3}`)),
      ],
    })

    const result = calculateWeaponStats(gun, state)
    const breakdown = result.attackModes[0].damageBreakdown

    // heat + cold → blast, toxin remains alone
    const blast = breakdown.elemental.find((e) => e.type === "blast")
    const toxin = breakdown.elemental.find((e) => e.type === "toxin")
    expect(blast).toBeDefined()
    expect(toxin).toBeDefined()
  })

  it("handles innate weapon elements", () => {
    const gun = makeGun({
      totalDamage: 100,
      damage: { impact: 50, heat: 50 }, // innate heat
    })
    const coldMod = makePlacedMod("Cryo Rounds", [{ stats: ["+90% <DT_COLD_COLOR>Cold"] }])

    const state = makeEmptyBuildState({
      normalSlots: [
        makeSlot("normal-0", coldMod),
        ...Array.from({ length: 7 }, (_, i) => makeSlot(`normal-${i + 1}`)),
      ],
    })

    const result = calculateWeaponStats(gun, state)
    const breakdown = result.attackModes[0].damageBreakdown

    // Innate heat + cold mod → blast
    const blast = breakdown.elemental.find((e) => e.type === "blast")
    expect(blast).toBeDefined()
  })

  it("returns physical breakdown without elemental mods", () => {
    const gun = makeGun({
      totalDamage: 100,
      damage: { impact: 30, puncture: 40, slash: 30 },
    })
    const state = makeEmptyBuildState()
    const result = calculateWeaponStats(gun, state)
    const breakdown = result.attackModes[0].damageBreakdown

    expect(breakdown.physical.impact).toBe(30)
    expect(breakdown.physical.puncture).toBe(40)
    expect(breakdown.physical.slash).toBe(30)
    expect(breakdown.elemental).toHaveLength(0)
  })
})

// =============================================================================
// Attack modes
// =============================================================================

describe("calculateWeaponStats — attack modes", () => {
  it("uses attacks array when defined", () => {
    const gun = makeGun({
      totalDamage: undefined,
      damage: undefined,
      attacks: [
        {
          name: "Normal Attack",
          crit_chance: 30,
          crit_mult: 2.0,
          status_chance: 20,
          speed: 5,
          damage: { impact: 50, puncture: 50 },
        },
        {
          name: "Charged Shot",
          crit_chance: 50,
          crit_mult: 3.0,
          status_chance: 40,
          speed: 1,
          damage: { impact: 200 },
        },
      ],
    })
    const state = makeEmptyBuildState()
    const result = calculateWeaponStats(gun, state)

    expect(result.attackModes).toHaveLength(2)
    expect(result.attackModes[0].name).toBe("Normal Attack")
    expect(result.attackModes[1].name).toBe("Charged Shot")
  })

  it("normalizes crit chance: values > 1 treated as percentage", () => {
    const gun = makeGun({
      totalDamage: undefined,
      attacks: [
        {
          name: "Test",
          crit_chance: 34, // Already percentage (34%)
          damage: { impact: 100 },
        },
      ],
    })
    const state = makeEmptyBuildState()
    const result = calculateWeaponStats(gun, state)

    expect(result.attackModes[0].criticalChance.base).toBe(34)
  })

  it("normalizes crit chance: values <= 1 multiplied by 100", () => {
    const gun = makeGun({
      totalDamage: undefined,
      attacks: [
        {
          name: "Test",
          crit_chance: 0.34, // Decimal form → 34%
          damage: { impact: 100 },
        },
      ],
    })
    const state = makeEmptyBuildState()
    const result = calculateWeaponStats(gun, state)

    expect(result.attackModes[0].criticalChance.base).toBe(34)
  })
})
