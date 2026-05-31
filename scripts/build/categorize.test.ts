import { describe, expect, it } from "bun:test"

import { categorizeWeapon, isExaltedWeapon } from "./categorize"
import type { MergedWeapon } from "./merge-weapons"

// Only the fields categorize reads matter; cast a partial to keep fixtures lean.
function weapon(w: Partial<MergedWeapon>): MergedWeapon {
  return w as MergedWeapon
}

// Voidrig's exalted arch-gun — a genuine summoned exalted (SpecialItems).
const ARQUEBEX = weapon({
  uniqueName:
    "/Lotus/Types/Enemies/Orokin/Entrati/EntratiTech/NechroTech/ExaltedArtilleryWeapon",
  name: "Arquebex",
  displayClass: "Exalted Weapon",
  slot: "Archgun (Atmosphere)",
  productCategory: "SpecialItems",
})
// Garuda's Talons — cross-referenced exalted the wiki tags Class="Claws" (not
// "Exalted Weapon"), so it's only recognised via the exaltedSet + its
// SpecialItems productCategory. Guards the productCategory discriminator.
const GARUDA_TALONS = weapon({
  uniqueName: "/Lotus/Powersuits/Devil/RippedTalons/DevilTalonWeapon",
  name: "Garuda Talons",
  displayClass: "Claws",
  slot: "Melee",
  productCategory: "SpecialItems",
})
// The Necramechs' standard equipped arch-gun. Both list it in `exalted[]`, but
// it's a normal, independently-built Archgun — not a summoned exalted.
const MAUSOLON = weapon({
  uniqueName:
    "/Lotus/Weapons/Tenno/Archwing/Primary/ThanoTechArchLongGun/ThanoTechLongGun",
  name: "Mausolon",
  displayClass: "Archgun",
  slot: "Archgun",
  productCategory: "SpaceGuns",
})

// Mirrors the real data: a Necramech lists its exalted weapon AND Mausolon.
const exaltedSet = new Set([
  ARQUEBEX.uniqueName,
  GARUDA_TALONS.uniqueName,
  MAUSOLON.uniqueName,
])

describe("isExaltedWeapon", () => {
  it("treats wiki-tagged Exalted Weapons as exalted", () => {
    expect(isExaltedWeapon(ARQUEBEX, exaltedSet)).toBe(true)
  })

  it("treats cross-referenced exalteds (Garuda's Talons) as exalted", () => {
    expect(isExaltedWeapon(GARUDA_TALONS, exaltedSet)).toBe(true)
  })

  it("does NOT treat a Necramech's standard arch-gun (Mausolon) as exalted", () => {
    // It only appears in `exalted[]` because the mech equips it by default;
    // it's a standalone SpaceGuns weapon, so it stays a plain Archgun.
    expect(isExaltedWeapon(MAUSOLON, exaltedSet)).toBe(false)
  })
})

describe("categorizeWeapon", () => {
  it("routes Mausolon to archwing only, never exalted-weapons", () => {
    const cats = categorizeWeapon(MAUSOLON, exaltedSet)
    expect(cats).toEqual(["archwing"])
  })

  it("routes a genuine exalted to both its base slot and exalted-weapons", () => {
    expect(categorizeWeapon(ARQUEBEX, exaltedSet)).toEqual([
      "archwing",
      "exalted-weapons",
    ])
  })

  it("routes a cross-referenced SpecialItems exalted (Garuda's Talons) to exalted-weapons", () => {
    expect(categorizeWeapon(GARUDA_TALONS, exaltedSet)).toEqual([
      "melee",
      "exalted-weapons",
    ])
  })
})
