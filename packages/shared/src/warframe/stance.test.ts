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
    type: "Stance Mod",
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

describe("getModsForItem stance filtering", () => {
  const polearmStance = modFixture({
    uniqueName: "/Lotus/Mods/Stances/BleedingWillow",
    name: "Bleeding Willow",
    type: "Stance Mod",
    compatName: "Polearms",
  })
  const heavyBladeStance = modFixture({
    uniqueName: "/Lotus/Mods/Stances/CleavingWhirlwind",
    name: "Cleaving Whirlwind",
    type: "Stance Mod",
    compatName: "Heavy Blade",
  })
  const meleeMod = modFixture({
    uniqueName: "/Lotus/Mods/Test/PressurePoint",
    name: "Pressure Point",
    type: "Melee Mod",
    compatName: "Melee",
  })
  const mods = [polearmStance, heavyBladeStance, meleeMod]

  it("returns every stance when meleeClass is missing (fail-open)", () => {
    const result = getModsForItem({ type: "Melee", name: "Orthos" }, mods)
    expect(result).toContain(polearmStance)
    expect(result).toContain(heavyBladeStance)
    expect(result).toContain(meleeMod)
  })

  it("filters stances to the weapon's meleeClass", () => {
    const result = getModsForItem(
      { type: "Melee", name: "Orthos", meleeClass: "Polearms" },
      mods,
    )
    expect(result).toContain(polearmStance)
    expect(result).not.toContain(heavyBladeStance)
    expect(result).toContain(meleeMod)
  })

  it("matches meleeClass case-insensitively", () => {
    const result = getModsForItem(
      { type: "Melee", name: "Orthos", meleeClass: "polearms" },
      mods,
    )
    expect(result).toContain(polearmStance)
    expect(result).not.toContain(heavyBladeStance)
  })

  it("excludes stance mods from an exalted melee weapon's pool", () => {
    // Exalted melees (Exalted Blade etc.) have no swappable stance slot.
    const result = getModsForItem(
      {
        type: "Exalted Weapon",
        name: "Exalted Blade",
        uniqueName: "/Lotus/Powersuits/Excalibur/ExaltedBlade",
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
    const result = getModsForItem(
      {
        type: "Exalted Weapon",
        name: "Ironbride",
        uniqueName: "/Lotus/Powersuits/EntratiMech/Bonewidow/Ironbride",
      },
      [...mods, archMeleeMod],
    )
    expect(result).toContain(archMeleeMod)
    expect(result).not.toContain(polearmStance)
    expect(result).not.toContain(meleeMod)
  })
})
