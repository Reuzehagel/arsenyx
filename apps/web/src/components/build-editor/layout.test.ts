import type { Arcane } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import type { DetailItem } from "@/lib/warframe"

import {
  getArcaneSlotConfig,
  getArcaneSlotCount,
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

describe("getArcaneSlotCount", () => {
  it("gives kitguns two slots (weapon arcane + Pax/Residual)", () => {
    expect(getArcaneSlotCount("secondary", KITGUN_SECONDARY)).toBe(2)
    expect(getArcaneSlotCount("primary", KITGUN_SECONDARY)).toBe(2)
  })

  it("gives ordinary weapons one slot", () => {
    expect(getArcaneSlotCount("secondary", NORMAL_PISTOL)).toBe(1)
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
