import type { Gun, Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { calculateWeaponStats } from "./weapon"

function makeWeapon(overrides: Partial<Gun> = {}): Gun {
  return {
    name: "Test",
    uniqueName: "/Lotus/Test",
    tradable: false,
    type: "Rifle",
    damage: {},
    totalDamage: 0,
    criticalChance: 0.05,
    criticalMultiplier: 1.5,
    procChance: 0.1,
    fireRate: 12,
    magazineSize: 40,
    reloadTime: 2,
    ...(overrides as object),
  } as unknown as Gun
}

// Uses the in-game color-tag format that the parser recognizes via
// COLOR_TAG_PATTERN, e.g. "+90% <DT_FIRE_COLOR>Heat".
function elementMod(
  name: string,
  pct: number,
  colorTag: string,
  label: string,
): Mod {
  return {
    name,
    levelStats: [{ stats: [`+${pct}% <${colorTag}>${label}`] }],
  } as unknown as Mod
}

function elemMap(stats: ReturnType<typeof calculateWeaponStats>) {
  const breakdown = stats.attackModes[0]!.damageBreakdown
  const map = new Map<string, number>()
  for (const e of breakdown.elemental) map.set(e.type, e.value)
  return map
}

// Regression: innate Electricity + Cold mod + Electricity mod must combine
// to a single Magnetic entry with no standalone Electricity left over. Per
// wiki, innate base elements fold into an already-established combination
// that contains their type.
describe("damage breakdown — innate + mod combination", () => {
  it("innate Electricity + Cold + Electricity mods → only Magnetic", () => {
    const weapon = makeWeapon({ damage: { electricity: 6 }, totalDamage: 6 })
    const stats = calculateWeaponStats({
      weapon,
      mods: [
        {
          mod: elementMod("Rime Rounds", 60, "DT_FREEZE_COLOR", "Cold"),
          rank: 0,
        },
        {
          mod: elementMod(
            "High Voltage",
            90,
            "DT_ELECTRICITY_COLOR",
            "Electricity",
          ),
          rank: 0,
        },
      ],
      arcanes: [],
    })
    const map = elemMap(stats)
    expect(map.has("magnetic")).toBe(true)
    expect(map.has("electricity")).toBe(false)
    expect(map.has("cold")).toBe(false)
  })

  it("innate Electricity + Cold mod alone → Magnetic", () => {
    const weapon = makeWeapon({ damage: { electricity: 6 }, totalDamage: 6 })
    const stats = calculateWeaponStats({
      weapon,
      mods: [
        {
          mod: elementMod("Rime Rounds", 90, "DT_FREEZE_COLOR", "Cold"),
          rank: 0,
        },
      ],
      arcanes: [],
    })
    const map = elemMap(stats)
    expect(map.has("magnetic")).toBe(true)
    expect(map.has("cold")).toBe(false)
    expect(map.has("electricity")).toBe(false)
  })

  it("innate Heat with no compatible mods stays standalone", () => {
    const weapon = makeWeapon({ damage: { heat: 10 }, totalDamage: 10 })
    const stats = calculateWeaponStats({ weapon, mods: [], arcanes: [] })
    const map = elemMap(stats)
    expect(map.has("heat")).toBe(true)
  })

  it("innate Cold + Heat mod combines to Blast (no leftover Cold)", () => {
    const weapon = makeWeapon({ damage: { cold: 10 }, totalDamage: 10 })
    const stats = calculateWeaponStats({
      weapon,
      mods: [
        { mod: elementMod("Hellfire", 90, "DT_FIRE_COLOR", "Heat"), rank: 0 },
      ],
      arcanes: [],
    })
    const map = elemMap(stats)
    expect(map.has("blast")).toBe(true)
    expect(map.has("cold")).toBe(false)
    expect(map.has("heat")).toBe(false)
  })

  it("innate Heat with two mods that combine — innate folds into combo", () => {
    // Heat mod + Cold mod → Blast (contains Heat). Innate Heat then folds
    // into Blast, not a standalone Heat entry.
    const weapon = makeWeapon({ damage: { heat: 10 }, totalDamage: 10 })
    const stats = calculateWeaponStats({
      weapon,
      mods: [
        { mod: elementMod("Hellfire", 90, "DT_FIRE_COLOR", "Heat"), rank: 0 },
        {
          mod: elementMod("Cryo Rounds", 90, "DT_FREEZE_COLOR", "Cold"),
          rank: 0,
        },
      ],
      arcanes: [],
    })
    const map = elemMap(stats)
    expect(map.has("blast")).toBe(true)
    expect(map.has("heat")).toBe(false)
    expect(map.has("cold")).toBe(false)
  })
})

describe("crit / status percent scaling", () => {
  // Regression: Pox/Sporothrix have a 1% base crit. The wiki per-attack
  // crit_chance is stored as a percentage (1 = 1%), so it must be used as-is.
  // The old heuristic (×100 for any value ≤ 1) inflated it to 100%.
  it("uses a sub-1% wiki attack crit_chance as a literal percent", () => {
    const weapon = makeWeapon({
      criticalChance: 0.0099999998,
      procChance: 0.0099999998,
      damage: { impact: 10 },
      totalDamage: 10,
      attacks: [
        {
          name: "Spore Impact",
          damage: { impact: 10 },
          crit_chance: 1,
          crit_mult: 2,
          status_chance: 1,
        },
      ],
    })
    const stats = calculateWeaponStats({ weapon, mods: [], arcanes: [] })
    const mode = stats.attackModes[0]!
    expect(mode.criticalChance.base).toBe(1)
    expect(mode.criticalChance.modified).toBe(1)
    expect(mode.statusChance.base).toBe(1)
  })

  it("keeps full-scale wiki attack crit_chance unchanged (35 → 35%)", () => {
    const weapon = makeWeapon({
      criticalChance: 0.35,
      damage: { impact: 10 },
      totalDamage: 10,
      attacks: [
        { name: "Normal Attack", damage: { impact: 10 }, crit_chance: 35 },
      ],
    })
    const stats = calculateWeaponStats({ weapon, mods: [], arcanes: [] })
    expect(stats.attackModes[0]!.criticalChance.base).toBe(35)
  })

  it("converts the DE 0–1 ratio for weapons without per-attack data", () => {
    // No `attacks` array → falls back to weapon.criticalChance (a ratio).
    const weapon = makeWeapon({
      criticalChance: 0.05,
      procChance: 0.1,
      damage: { impact: 10 },
      totalDamage: 10,
    })
    const stats = calculateWeaponStats({ weapon, mods: [], arcanes: [] })
    const mode = stats.attackModes[0]!
    expect(mode.criticalChance.base).toBe(5)
    expect(mode.statusChance.base).toBeCloseTo(10)
  })
})
