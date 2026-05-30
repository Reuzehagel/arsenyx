import { describe, expect, it } from "vitest"

import {
  defaultKitgunComponents,
  isKitgunChamber,
  KITGUN_GRIPS,
  KITGUN_LOADERS,
  kitgunGripsFor,
  kitgunLoadersFor,
} from "./kitgun-data"

const SOLARIS_CHAMBER =
  "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelAPart"
const ENTRATI_CHAMBER =
  "/Lotus/Weapons/Infested/Pistols/InfKitGun/Barrels/InfBarrelEgg/InfModularBarrelEggPart"

describe("isKitgunChamber", () => {
  it("detects Solaris and Entrati chambers", () => {
    expect(isKitgunChamber(SOLARIS_CHAMBER)).toBe(true)
    expect(isKitgunChamber(ENTRATI_CHAMBER)).toBe(true)
  })

  it("ignores non-kitgun items (incl. kitgun part paths that aren't barrels)", () => {
    expect(isKitgunChamber("/Lotus/Weapons/Tenno/Pistol/Lex")).toBe(false)
    expect(isKitgunChamber(undefined)).toBe(false)
    // A grip part is not a chamber.
    expect(isKitgunChamber(KITGUN_GRIPS[0].uniqueName)).toBe(false)
  })
})

describe("part option filtering", () => {
  it("offers every grip of the matching class, regardless of maker", () => {
    // Secondary chamber → all 5 secondary grips, incl. the Entrati Ulnaris
    // (parts cross-mix; only the class is constrained).
    const secondary = kitgunGripsFor("secondary")
    expect(secondary.map((g) => g.name).sort()).toEqual([
      "Gibber",
      "Haymaker",
      "Lovetap",
      "Ramble",
      "Ulnaris",
    ])
    expect(secondary.every((g) => g.class === "secondary")).toBe(true)

    const primary = kitgunGripsFor("primary")
    expect(primary.map((g) => g.name).sort()).toEqual([
      "Brash",
      "Palmaris",
      "Shrewd",
      "Steadyslam",
      "Tremor",
    ])
  })

  it("offers every loader regardless of maker or class", () => {
    expect(kitgunLoadersFor()).toHaveLength(20)
    expect(kitgunLoadersFor()).toBe(KITGUN_LOADERS)
  })
})

describe("defaults", () => {
  it("seeds a valid grip + loader for each class", () => {
    for (const cls of ["primary", "secondary"] as const) {
      const { grip, loader } = defaultKitgunComponents(cls)
      expect(kitgunGripsFor(cls).map((g) => g.name)).toContain(grip)
      expect(kitgunLoadersFor().map((l) => l.name)).toContain(loader)
    }
  })
})

describe("data invariants", () => {
  it("part names are globally unique (so name-keying the build is safe)", () => {
    const names = [...KITGUN_GRIPS, ...KITGUN_LOADERS].map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("every grip carries a class and a uniqueName", () => {
    for (const g of KITGUN_GRIPS) {
      expect(g.class === "primary" || g.class === "secondary").toBe(true)
      expect(g.uniqueName).toMatch(/^\/Lotus\/Weapons\//)
    }
  })
})
