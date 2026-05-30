import { describe, expect, it } from "vitest"

import { decodeBuild, encodeBuild } from "./build-codec"
import { getModsForItem } from "./mods"
import type { BuildState, Mod, ModSlot, PlacedMod } from "./types"

function modFixture(overrides: Partial<Mod>): Mod {
  return {
    uniqueName: "/Lotus/Mods/Test",
    name: "Test Mod",
    polarity: "madurai",
    rarity: "Common",
    baseDrain: 4,
    fusionLimit: 5,
    type: "Melee Mod",
    tradable: true,
    ...overrides,
  }
}

function placedModFixture(overrides: Partial<PlacedMod>): PlacedMod {
  return {
    uniqueName: "/Lotus/Mods/Stances/BleedingWillow",
    name: "Bleeding Willow",
    polarity: "naramon",
    baseDrain: 0,
    fusionLimit: 4,
    rank: 4,
    rarity: "Uncommon",
    type: "Stance",
    compatName: "Polearms",
    ...overrides,
  }
}

function buildStateFixture(stanceSlot?: ModSlot): BuildState {
  return {
    itemUniqueName: "/Lotus/Weapons/Tenno/Melee/Polearm/Orthos",
    itemName: "Orthos",
    itemCategory: "melee",
    hasReactor: false,
    auraSlots: [],
    normalSlots: Array.from({ length: 8 }, (_, i) => ({
      id: `normal-${i}`,
      type: "normal" as const,
    })),
    arcaneSlots: [],
    shardSlots: [],
    baseCapacity: 30,
    currentCapacity: 30,
    formaCount: 0,
    stanceSlot,
  }
}

describe("build-codec stance slot round-trip", () => {
  it("encodes and decodes a stance slot with a placed mod", () => {
    const stanceSlot: ModSlot = {
      id: "stance",
      type: "stance",
      mod: placedModFixture({ rank: 3 }),
    }
    const encoded = encodeBuild(buildStateFixture(stanceSlot))
    const decoded = decodeBuild(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded?.stanceSlot?.id).toBe("stance")
    expect(decoded?.stanceSlot?.type).toBe("stance")
    expect(decoded?.stanceSlot?.mod?.uniqueName).toBe(
      "/Lotus/Mods/Stances/BleedingWillow",
    )
    expect(decoded?.stanceSlot?.mod?.rank).toBe(3)
  })

  it("encodes and decodes forma polarity on an empty stance slot", () => {
    const stanceSlot: ModSlot = {
      id: "stance",
      type: "stance",
      formaPolarity: "madurai",
    }
    const decoded = decodeBuild(encodeBuild(buildStateFixture(stanceSlot)))

    expect(decoded?.stanceSlot?.formaPolarity).toBe("madurai")
    expect(decoded?.stanceSlot?.mod).toBeUndefined()
  })

  it("omits the stance slot from the URL when empty and without forma", () => {
    const encoded = encodeBuild(buildStateFixture(undefined))
    const decoded = decodeBuild(encoded)

    expect(decoded?.stanceSlot).toBeUndefined()
  })
})

// Stance filtering through the modern (modPools) router. Tests pass the
// shapes the build pipeline emits — verified against the per-item JSON in
// apps/web/public/data/items/. Stance compat lives in `modPools` directly
// ("Polearms" is added to Orthos's pool, "Swords" to Exalted Blade's), so
// pool membership alone gates the mod. `meleeClass` is only consulted as
// an extra narrowing step when a wider pool overlaps multiple stance
// classes (rare under the modern emitter).
describe("getModsForItem stance filtering", () => {
  const polearmStance = modFixture({
    uniqueName: "/Lotus/Mods/Stances/BleedingWillow",
    name: "Bleeding Willow",
    type: "Stance",
    compatName: "Polearms",
  })
  const heavyBladeStance = modFixture({
    uniqueName: "/Lotus/Mods/Stances/CleavingWhirlwind",
    name: "Cleaving Whirlwind",
    type: "Stance",
    compatName: "Heavy Blade",
  })
  const meleeMod = modFixture({
    uniqueName: "/Lotus/Mods/Test/PressurePoint",
    name: "Pressure Point",
    type: "Melee Mod",
    compatName: "Melee",
  })
  const mods = [polearmStance, heavyBladeStance, meleeMod]

  it("admits stances whose compatName is in the item's modPools", () => {
    // Orthos: modPools=["Melee","Polearms","Orthos"]. The polearm stance
    // matches "Polearms"; the heavy blade stance has no overlap.
    const result = getModsForItem(
      { modPools: ["Melee", "Polearms", "Orthos"] },
      mods,
    )
    expect(result).toContain(polearmStance)
    expect(result).not.toContain(heavyBladeStance)
    expect(result).toContain(meleeMod)
  })

  it("narrows further by meleeClass when supplied", () => {
    // Synthetic item with two stance pools — meleeClass forces the
    // polearm-only pick. Real items don't ship this shape today, but the
    // refinement is the documented contract for future multi-stance pools
    // (e.g. a wide curated override).
    const widePool = ["Melee", "Polearms", "Heavy Blade"]
    const result = getModsForItem(
      { modPools: widePool, meleeClass: "Polearms" },
      mods,
    )
    expect(result).toContain(polearmStance)
    expect(result).not.toContain(heavyBladeStance)
    expect(result).toContain(meleeMod)
  })

  it("matches meleeClass case-insensitively", () => {
    const widePool = ["Melee", "Polearms", "Heavy Blade"]
    const result = getModsForItem(
      { modPools: widePool, meleeClass: "polearms" },
      mods,
    )
    expect(result).toContain(polearmStance)
    expect(result).not.toContain(heavyBladeStance)
  })

  it("admits sword stances on Exalted Blade (Swords is in its pool)", () => {
    // Exalted Blade: modPools=["Melee","Swords","Exalted Blade"]. Polearm
    // and Heavy Blade stances aren't in pool → filtered. A sword stance
    // would pass — that's the picker's job to decide whether the slot is
    // even editable (exalted melees have no stance slot in-game).
    const result = getModsForItem(
      {
        uniqueName: "/Lotus/Powersuits/Excalibur/ExaltedBlade",
        modPools: ["Melee", "Swords", "Exalted Blade"],
      },
      mods,
    )
    expect(result).toContain(meleeMod)
    expect(result).not.toContain(polearmStance)
    expect(result).not.toContain(heavyBladeStance)
  })

  it("routes a necramech exalted to arch-melee, never stance", () => {
    const archMeleeMod = modFixture({
      uniqueName: "/Lotus/Mods/ArchMelee/ArchMeleeDamageMod",
      name: "Arch-Melee Damage",
      type: "Arch-Melee Mod",
      compatName: "ArchMelee",
    })
    // Ironbride: modPools=["ArchMelee","Ironbride"] — no "Melee" pool, so
    // both regular melee mods and any (Polearm/Heavy Blade) stances are
    // shut out structurally.
    const result = getModsForItem(
      {
        uniqueName: "/Lotus/Powersuits/EntratiMech/Bonewidow/Ironbride",
        modPools: ["ArchMelee", "Ironbride"],
      },
      [...mods, archMeleeMod],
    )
    expect(result).toContain(archMeleeMod)
    expect(result).not.toContain(polearmStance)
    expect(result).not.toContain(meleeMod)
  })
})
