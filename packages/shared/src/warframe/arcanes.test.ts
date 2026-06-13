import { describe, expect, it } from "vitest"

import {
  getArcanesForCategory,
  getArcanesForSlot,
  getArcanesForWeapon,
  isKitgunWeapon,
  isZawArcane,
} from "./arcanes"
import type { Arcane } from "./types"

/** Minimal Arcane fixture. `slotType` is the authoritative wiki equip slot;
 *  `type` is DE's effect bucket (not a slot). */
function arc(name: string, slotType?: string, type = "Utility"): Arcane {
  return { uniqueName: `/test/${name}`, name, type, slotType, tradable: true }
}

// The catalogue spans every wiki slot type the router has to place.
const ARCANES: Arcane[] = [
  arc("Arcane Energize", "Warframe"),
  // Weapon-flavored effect but a WARFRAME arcane (the classic trap — equips
  // on the frame, must NOT appear in a weapon picker).
  arc("Arcane Velocity", "Warframe", "Offensive"),
  arc("Primary Exhilarate", "Primary", "Offensive"),
  arc("Cascadia Flare", "Secondary", "Offensive"),
  arc("Longbow Sharpshot", "Bow", "Offensive"),
  arc("Shotgun Vendetta", "Shotgun", "Offensive"),
  arc("Pax Bolt", "Kitgun", "Utility"),
  arc("Residual Boils", "Kitgun", "Offensive"),
  arc("Exodia Force", "Zaw", "Offensive"),
  arc("Theorem Demulcent", "Melee", "Offensive"),
  arc("Magus Aggress", "Operator", "Offensive"),
  arc("Virtuos Forge", "Amp", "Offensive"),
  arc("Zid-An Asheir", "Tektolyst Artifacts", "Offensive"),
]

const namesIn = (slot: Parameters<typeof getArcanesForSlot>[1]) =>
  getArcanesForSlot(ARCANES, slot).map((a) => a.name)

describe("getArcanesForSlot — routes by authoritative wiki slotType", () => {
  it("frame picker shows only Warframe-type arcanes (incl. weapon-buff ones)", () => {
    const wf = namesIn("warframe")
    expect(wf).toContain("Arcane Energize")
    expect(wf).toContain("Arcane Velocity") // weapon effect, frame slot
    expect(wf).not.toContain("Cascadia Flare")
    expect(wf).not.toContain("Magus Aggress")
  })

  it("secondary includes secondary + kitgun arcanes, not frame arcanes", () => {
    const sec = namesIn("secondary")
    expect(sec).toContain("Cascadia Flare")
    expect(sec).toContain("Pax Bolt")
    expect(sec).toContain("Residual Boils")
    expect(sec).not.toContain("Arcane Velocity")
  })

  it("primary includes primary/bow/shotgun + kitgun arcanes", () => {
    const pri = namesIn("primary")
    expect(pri).toContain("Longbow Sharpshot")
    expect(pri).toContain("Shotgun Vendetta")
    expect(pri).toContain("Pax Bolt")
    expect(pri).toContain("Residual Boils")
  })

  it("kitgun arcanes appear on BOTH primary and secondary", () => {
    expect(namesIn("primary")).toContain("Pax Bolt")
    expect(namesIn("secondary")).toContain("Pax Bolt")
  })

  it("melee includes Melee + Zaw arcanes", () => {
    const m = namesIn("melee")
    expect(m).toContain("Exodia Force")
    expect(m).toContain("Theorem Demulcent")
  })

  it("operator includes Operator / Amp / Tektolyst, excludes them everywhere else", () => {
    const op = namesIn("operator")
    expect(op).toEqual(
      expect.arrayContaining([
        "Magus Aggress",
        "Virtuos Forge",
        "Zid-An Asheir",
      ]),
    )
    for (const slot of ["warframe", "primary", "secondary", "melee"] as const) {
      expect(namesIn(slot)).not.toContain("Magus Aggress")
      expect(namesIn(slot)).not.toContain("Zid-An Asheir")
    }
  })

  it('"weapon" slot is every weapon arcane, no frame/operator arcanes', () => {
    const w = namesIn("weapon")
    expect(w).toEqual(
      expect.arrayContaining([
        "Cascadia Flare",
        "Longbow Sharpshot",
        "Pax Bolt",
        "Exodia Force",
      ]),
    )
    expect(w).not.toContain("Arcane Energize")
    expect(w).not.toContain("Magus Aggress")
  })

  it("places an arcane with no slotType in no slot (fail-closed)", () => {
    // Every catalog arcane carries a slotType; routing is purely slotType-based,
    // so a slotType-less arcane is un-routable rather than name-guessed.
    const orphan: Arcane[] = [arc("Arcane Pistoleer")] // no slotType
    for (const slot of [
      "warframe",
      "primary",
      "secondary",
      "melee",
      "weapon",
      "operator",
    ] as const) {
      expect(getArcanesForSlot(orphan, slot)).toEqual([])
    }
  })
})

describe("getArcanesForWeapon — gates weapon sub-pools by class", () => {
  // Real uniqueName shapes from the catalog. Primary + secondary kitguns
  // SHARE a uniqueName; the primary variant just reports a gun displayClass.
  const KITGUN_UNIQUE =
    "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelAPart"
  const rifle = { displayClass: "Rifle", uniqueName: "/W/Acceltra" }
  const shotgun = { displayClass: "Shotgun", uniqueName: "/W/ArcaPlasmor" }
  const bow = { displayClass: "Bow", uniqueName: "/W/Paris" }
  const pistol = { displayClass: "Pistol", uniqueName: "/W/Lex" }
  const kitgunSecondary = { displayClass: "Pistol", uniqueName: KITGUN_UNIQUE }
  const kitgunPrimary = { displayClass: "Shotgun", uniqueName: KITGUN_UNIQUE }

  const wn = (cat: "primary" | "secondary", w: typeof rifle) =>
    getArcanesForWeapon(ARCANES, cat, w).map((a) => a.name)

  it("rifle gets generic Primary arcanes only — the reported bug", () => {
    const r = wn("primary", rifle)
    expect(r).toContain("Primary Exhilarate")
    expect(r).not.toContain("Shotgun Vendetta")
    expect(r).not.toContain("Longbow Sharpshot")
    expect(r).not.toContain("Pax Bolt")
    expect(r).not.toContain("Residual Boils")
  })

  it("shotgun adds Shotgun arcanes; still no bow/kitgun", () => {
    const s = wn("primary", shotgun)
    expect(s).toContain("Primary Exhilarate")
    expect(s).toContain("Shotgun Vendetta")
    expect(s).not.toContain("Longbow Sharpshot")
    expect(s).not.toContain("Pax Bolt")
  })

  it("bow adds Bow arcanes; no shotgun/kitgun", () => {
    const b = wn("primary", bow)
    expect(b).toContain("Longbow Sharpshot")
    expect(b).not.toContain("Shotgun Vendetta")
    expect(b).not.toContain("Pax Bolt")
  })

  it("regular pistol gets Secondary arcanes only — no kitgun", () => {
    const p = wn("secondary", pistol)
    expect(p).toContain("Cascadia Flare")
    expect(p).not.toContain("Pax Bolt")
    expect(p).not.toContain("Residual Boils")
  })

  it("secondary kitgun adds Kitgun arcanes", () => {
    const k = wn("secondary", kitgunSecondary)
    expect(k).toContain("Cascadia Flare")
    expect(k).toContain("Pax Bolt")
    expect(k).toContain("Residual Boils")
  })

  it("primary kitgun gets Primary + Kitgun, NOT Shotgun (it's not a real shotgun)", () => {
    const k = wn("primary", kitgunPrimary)
    expect(k).toContain("Primary Exhilarate")
    expect(k).toContain("Pax Bolt")
    expect(k).not.toContain("Shotgun Vendetta")
  })
})

describe("isKitgunWeapon", () => {
  it("detects SU and Infested modular barrels; rejects normal weapons", () => {
    expect(
      isKitgunWeapon({
        uniqueName:
          "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Barrel/SUModularSecondaryBarrelAPart",
      }),
    ).toBe(true)
    expect(
      isKitgunWeapon({
        uniqueName:
          "/Lotus/Weapons/Infested/Pistols/InfKitGun/Barrels/InfBarrelEgg/InfModularBarrelEggPart",
      }),
    ).toBe(true)
    expect(
      isKitgunWeapon({ uniqueName: "/Lotus/Weapons/Tenno/LongGuns/Soma" }),
    ).toBe(false)
    expect(isKitgunWeapon({})).toBe(false)
  })
})

describe("isZawArcane", () => {
  it("matches arcanes with the Zaw slotType", () => {
    expect(isZawArcane(arc("Exodia Force", "Zaw"))).toBe(true)
    expect(isZawArcane(arc("Arcane Energize", "Warframe"))).toBe(false)
  })
})

describe("getArcanesForCategory", () => {
  it("warframes → frame arcanes only", () => {
    const names = getArcanesForCategory(ARCANES, "warframes").map((a) => a.name)
    expect(names).toContain("Arcane Energize")
    expect(names).not.toContain("Cascadia Flare")
  })

  it("melee → melee arcanes", () => {
    expect(
      getArcanesForCategory(ARCANES, "melee").map((a) => a.name),
    ).toContain("Exodia Force")
  })

  it("archwing → primary + secondary arcanes", () => {
    const names = getArcanesForCategory(ARCANES, "archwing").map((a) => a.name)
    expect(names).toContain("Longbow Sharpshot")
    expect(names).toContain("Cascadia Flare")
  })
})
