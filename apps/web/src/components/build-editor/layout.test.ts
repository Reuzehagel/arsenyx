import type { Arcane } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import type { DetailItem } from "@/lib/warframe"

import {
  getArcaneSlotConfig,
  getArcaneSlotCount,
  getAuraSlotCount,
  getLockedStance,
  hasExilusSlot,
  hasLockedStance,
  hasStanceSlot,
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
  arc("Melee Influence", "Melee", "Offensive"),
  arc("Exodia Force", "Zaw", "Offensive"),
]

const ZAW_STRIKE: Pick<DetailItem, "name" | "displayClass" | "uniqueName"> = {
  name: "Plague Keewar",
  displayClass: "Zaw Polearm / Hammer",
  uniqueName: "/Lotus/Weapons/Ostron/Melee/LordMelee/Tips/PlagueTip",
}
const GLAIVE: Pick<DetailItem, "name" | "displayClass" | "uniqueName"> = {
  name: "Falcor",
  displayClass: "Thrown",
  uniqueName: "/Lotus/Weapons/Tenno/Melee/Thrown/Falcor/Falcor",
}

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

// Companion weapons split by displayClass: beast claws ("Claws (Beast)") carry
// a Penjaga Posture slot rendered as the stance slot; robotic/sentinel weapons
// have neither a stance nor an exilus slot.
const ADARZA_CLAWS: Pick<DetailItem, "stancePolarity" | "displayClass"> = {
  displayClass: "Claws (Beast)",
  stancePolarity: "penjaga",
}
const SWEEPER: Pick<DetailItem, "stancePolarity" | "displayClass"> = {
  displayClass: "Shotgun (Sentinel)",
  stancePolarity: undefined,
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

  it("denies an exilus slot to companion weapons (sentinel + beast)", () => {
    // Robotic/Sentinel weapons have no exilus slot and can't take arcanes;
    // beast claws carry a Posture (stance) slot instead.
    expect(hasExilusSlot("companion-weapons", SWEEPER)).toBe(false)
    expect(hasExilusSlot("companion-weapons", ADARZA_CLAWS)).toBe(false)
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

// Desert Wind (Baruuk): a locked exalted melee — Zenurik stance polarity plus
// a permanently installed Serene Storm stance emitted as `innateStance`.
const DESERT_WIND: Pick<
  DetailItem,
  "displayClass" | "uniqueName" | "stancePolarity" | "innateStance"
> = {
  displayClass: "Exalted Weapon",
  uniqueName: "/Lotus/Powersuits/Pacifist/PacifistFist",
  stancePolarity: "zenurik",
  innateStance: { name: "Serene Storm", imageName: "https://img/serene.png" },
}
// Garuda Talons: the exception — a *free* Claw stance slot (Madurai), so it
// carries a stancePolarity but NO innateStance (not locked).
const GARUDA_TALONS: Pick<
  DetailItem,
  "displayClass" | "uniqueName" | "stancePolarity" | "innateStance"
> = {
  displayClass: "Claws",
  uniqueName: "/Lotus/Powersuits/Garuda/GarudaBaseFusedClaws",
  stancePolarity: "madurai",
}

describe("hasStanceSlot", () => {
  it("surfaces a stance slot for melee exalted weapons (locked and free)", () => {
    // Exalted Blade et al. are frame *melee* exalteds: they carry
    // stancePolarity + innateStance and render a locked stance slot.
    expect(hasStanceSlot(DESERT_WIND, "exalted-weapons")).toBe(true)
    expect(hasStanceSlot(GARUDA_TALONS, "exalted-weapons")).toBe(true)
  })

  it("gives beast claws a stance (Posture) slot via their Penjaga polarity", () => {
    expect(hasStanceSlot(ADARZA_CLAWS, "companion-weapons")).toBe(true)
  })

  it("denies a stance slot to exalted guns / Necramech exalted (no stancePolarity)", () => {
    // Arquebex (arch-gun) and Ironbride (Necramech arch-melee) carry no
    // stancePolarity. (Exalted Blade is NOT here — it's a melee exalted with a
    // locked stance, asserted true above.)
    expect(hasStanceSlot(ARQUEBEX, "exalted-weapons")).toBe(false)
    expect(hasStanceSlot(IRONBRIDE, "exalted-weapons")).toBe(false)
  })

  it("denies a stance slot to sentinel weapons (no stancePolarity)", () => {
    expect(hasStanceSlot(SWEEPER, "companion-weapons")).toBe(false)
  })

  it("never surfaces a stance slot on the Plexus", () => {
    expect(hasStanceSlot({ stancePolarity: "naramon" }, "railjack")).toBe(false)
  })
})

describe("hasLockedStance / getLockedStance", () => {
  it("treats a locked exalted melee as having a fixed, pre-filled stance", () => {
    expect(hasLockedStance(DESERT_WIND, "exalted-weapons")).toBe(true)
    const locked = getLockedStance(DESERT_WIND, "exalted-weapons")
    expect(locked?.mod.name).toBe("Serene Storm")
    expect(locked?.mod.type).toBe("Stance")
    // Polarity mirrors the slot (Zenurik) so a max-rank stance yields +10.
    expect(locked?.mod.polarity).toBe("zenurik")
    expect(locked?.mod.imageName).toBe("https://img/serene.png")
  })

  it("gives Garuda Talons a normal (non-locked) stance slot", () => {
    expect(hasLockedStance(GARUDA_TALONS, "exalted-weapons")).toBe(false)
    expect(getLockedStance(GARUDA_TALONS, "exalted-weapons")).toBeUndefined()
  })

  it("never locks a stance outside the exalted-weapons category", () => {
    // A regular melee carrying the same fields wouldn't be a locked exalted.
    expect(hasLockedStance(DESERT_WIND, "melee")).toBe(false)
    expect(getLockedStance(DESERT_WIND, "melee")).toBeUndefined()
  })
})

describe("getArcaneSlotConfig — melee Exodia gating", () => {
  it("gives a Zaw a dedicated Exodia slot alongside the melee slot", () => {
    const cfg = getArcaneSlotConfig(ARCANES, "melee", 2, ZAW_STRIKE)
    expect(cfg.labels).toEqual(["Melee Arcane", "Exodia"])
    expect(cfg.options[0]!.map((a) => a.name)).toEqual(["Melee Influence"])
    expect(cfg.options[1]!.map((a) => a.name)).toEqual(["Exodia Force"])
  })

  it("keeps Exodia (Zaw-only) arcanes off an ordinary melee (glaive)", () => {
    const cfg = getArcaneSlotConfig(ARCANES, "melee", 1, GLAIVE)
    expect(cfg.options).toHaveLength(1)
    expect(cfg.options[0]!.map((a) => a.name)).toEqual(["Melee Influence"])
  })

  it("keeps Exodia off an exalted melee weapon (Exalted Blade)", () => {
    const cfg = getArcaneSlotConfig(ARCANES, "exalted-weapons", 1, {
      ...EXALTED_BLADE,
      name: "Exalted Blade",
    })
    expect(cfg.options[0]!.map((a) => a.name)).toEqual(["Melee Influence"])
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
