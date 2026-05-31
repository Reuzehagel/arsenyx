import type { Arcane } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import type { DetailItem } from "@/lib/warframe"

import {
  getArcaneSlotConfig,
  getArcaneSlotCount,
  getAuraSlotCount,
  hasExilusSlot,
  resolveInitialArcanes,
} from "./layout"
import type { PlacedArcane } from "./use-arcane-slots"

function arc(name: string, slotType?: string, type = "Utility"): Arcane {
  return { uniqueName: `/test/${name}`, name, type, slotType, tradable: true }
}

const ARCANES: Arcane[] = [
  arc("Cascadia Flare", "Secondary", "Offensive"),
  arc("Pax Bolt", "Kitgun"),
  arc("Residual Boils", "Kitgun", "Offensive"),
  arc("Shotgun Vendetta", "Shotgun", "Offensive"),
]

const KITGUN_SECONDARY: Pick<
  DetailItem,
  "name" | "trigger" | "displayClass" | "uniqueName"
> = {
  name: "Sporelacer (Secondary)",
  displayClass: "Pistol",
  uniqueName:
    "/Lotus/Weapons/Infested/Pistols/InfKitGun/Barrels/InfBarrelEgg/InfModularBarrelEggPart",
}
const NORMAL_PISTOL: Pick<DetailItem, "displayClass" | "uniqueName"> = {
  displayClass: "Pistol",
  uniqueName: "/Lotus/Weapons/Tenno/Pistol/Lex",
}

// Voidrig's Arquebex (arch-gun) and Bonewidow's Ironbride (arch-melee) are the
// only exalted weapons that mod from the Archgun/Archmelee pools. Mausolon
// shares the Archgun pool but is a regular arch-gun (displayClass "Archgun").
const ARQUEBEX: Pick<DetailItem, "displayClass" | "uniqueName" | "modPools"> = {
  displayClass: "Exalted Weapon",
  uniqueName:
    "/Lotus/Types/Enemies/Orokin/Entrati/EntratiTech/NechroTech/ExaltedArtilleryWeapon",
  modPools: ["Archgun", "Arquebex"],
}
const IRONBRIDE: Pick<DetailItem, "displayClass" | "uniqueName" | "modPools"> =
  {
    displayClass: "Exalted Weapon",
    uniqueName:
      "/Lotus/Types/Enemies/Orokin/Entrati/EntratiTech/NechroTech/AbilitySword/NechroTechSwordWeapon",
    modPools: ["Archmelee", "Ironbride"],
  }
const EXALTED_BLADE: Pick<
  DetailItem,
  "displayClass" | "uniqueName" | "modPools"
> = {
  displayClass: "Exalted Weapon",
  uniqueName: "/Lotus/Powersuits/Excalibur/DoomSword",
  modPools: ["Melee", "Swords", "Exalted Blade"],
}
const MAUSOLON: Pick<DetailItem, "displayClass" | "uniqueName" | "modPools"> = {
  displayClass: "Archgun",
  uniqueName:
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun",
  modPools: ["Archgun", "Mausolon"],
}

describe("getArcaneSlotCount", () => {
  it("gives kitguns two slots (weapon arcane + Pax/Residual)", () => {
    expect(getArcaneSlotCount("secondary", KITGUN_SECONDARY)).toBe(2)
    expect(getArcaneSlotCount("primary", KITGUN_SECONDARY)).toBe(2)
  })

  it("gives ordinary weapons one slot", () => {
    expect(getArcaneSlotCount("secondary", NORMAL_PISTOL)).toBe(1)
  })

  it("gives Necramech exalted weapons (Arquebex, Ironbride) no arcane slot", () => {
    expect(getArcaneSlotCount("exalted-weapons", ARQUEBEX)).toBe(0)
    expect(getArcaneSlotCount("exalted-weapons", IRONBRIDE)).toBe(0)
  })

  it("keeps the single arcane slot on frame exalted weapons", () => {
    expect(getArcaneSlotCount("exalted-weapons", EXALTED_BLADE)).toBe(1)
    // Mausolon shares the Archgun pool but isn't a Necramech exalted weapon.
    expect(getArcaneSlotCount("exalted-weapons", MAUSOLON)).toBe(1)
  })
})

describe("hasExilusSlot", () => {
  it("denies an exilus slot to Necramech exalted weapons", () => {
    expect(hasExilusSlot("exalted-weapons", ARQUEBEX)).toBe(false)
    expect(hasExilusSlot("exalted-weapons", IRONBRIDE)).toBe(false)
  })

  it("keeps the exilus slot on other exalted weapons", () => {
    expect(hasExilusSlot("exalted-weapons", EXALTED_BLADE)).toBe(true)
    expect(hasExilusSlot("exalted-weapons", MAUSOLON)).toBe(true)
  })

  it("defers to the category for non-exalted items", () => {
    expect(hasExilusSlot("primary", NORMAL_PISTOL)).toBe(true)
    expect(hasExilusSlot("companions", NORMAL_PISTOL)).toBe(false)
  })
})

describe("resolveInitialArcanes — kitgun re-bucketing", () => {
  const placed = (a: Arcane): PlacedArcane => ({ arcane: a, rank: 0 })

  it("routes a saved Pax/Residual arcane to slot 1, even from index 0", () => {
    // Old single-slot kitgun builds saved the Pax at index 0.
    const out = resolveInitialArcanes(KITGUN_SECONDARY, [
      placed(arc("Pax Bolt", "Kitgun")),
    ])
    expect(out).toEqual([null, placed(arc("Pax Bolt", "Kitgun"))])
  })

  it("keeps a weapon arcane in slot 0 and pairs it with a Pax", () => {
    const out = resolveInitialArcanes(KITGUN_SECONDARY, [
      placed(arc("Pax Bolt", "Kitgun")),
      placed(arc("Cascadia Flare", "Secondary")),
    ])
    expect(out).toEqual([
      placed(arc("Cascadia Flare", "Secondary")),
      placed(arc("Pax Bolt", "Kitgun")),
    ])
  })

  it("leaves non-modular weapons' saved order untouched", () => {
    const saved = [placed(arc("Cascadia Flare", "Secondary"))]
    expect(resolveInitialArcanes(NORMAL_PISTOL, saved)).toBe(saved)
  })
})

describe("getAuraSlotCount", () => {
  it("gives a warframe one aura slot even when the innate polarity is null", () => {
    // Excalibur / Nekros / Sevagoth ship with no default aura polarity but
    // still have the slot in-game.
    expect(getAuraSlotCount("warframes", { auraPolarity: null })).toBe(1)
  })

  it("gives a warframe one aura slot for a single innate polarity", () => {
    expect(getAuraSlotCount("warframes", { auraPolarity: "madurai" })).toBe(1)
  })

  it("matches the slot count to a multi-aura array (Jade: 2)", () => {
    expect(
      getAuraSlotCount("warframes", { auraPolarity: ["naramon", "vazarin"] }),
    ).toBe(2)
  })

  it("gives non-warframe categories no aura slot", () => {
    expect(getAuraSlotCount("primary", { auraPolarity: null })).toBe(0)
  })

  it("gives railjack its single Plexus aura slot", () => {
    expect(getAuraSlotCount("railjack", { auraPolarity: null })).toBe(1)
  })
})

describe("getArcaneSlotConfig — kitgun split", () => {
  it("puts weapon arcanes in slot 0 and Pax/Residual in slot 1", () => {
    const cfg = getArcaneSlotConfig(ARCANES, "secondary", 2, KITGUN_SECONDARY)
    expect(cfg.labels).toEqual(["Secondary Arcane", "Pax / Residual"])
    expect(cfg.options[0]!.map((a) => a.name)).toEqual(["Cascadia Flare"])
    expect(cfg.options[1]!.map((a) => a.name)).toEqual([
      "Pax Bolt",
      "Residual Boils",
    ])
  })
})
