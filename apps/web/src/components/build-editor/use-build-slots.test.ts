import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import {
  dropOrphanSlots,
  placedModsInSlotOrder,
  type PlacedMod,
  type SlotId,
  type SlotLayout,
} from "./use-build-slots"

function mod(name: string): PlacedMod {
  const m: Mod = {
    uniqueName: `/test/${name}`,
    name,
    polarity: "naramon",
    rarity: "Common",
    baseDrain: 4,
    fusionLimit: 5,
    type: "Normal",
    compatName: "BeastClaws",
    tradable: true,
  }
  return { mod: m, rank: 5 }
}

// A companion-weapon layout: no aura, no exilus, no stance — only 8 normals.
// (Beast claws additionally show a stance slot; this fixture is the strict
// "robotic weapon" case to prove an orphaned exilus mod is dropped.)
const COMPANION_WEAPON: SlotLayout = {
  normalSlotCount: 8,
  auraSlotCount: 0,
  showExilus: false,
  showStance: false,
}

describe("placedModsInSlotOrder", () => {
  it("orders by slot position, not equip order (#272)", () => {
    // Repro from the issue: Toxin in slot 1, Heat in slot 3, THEN Cold in
    // slot 2. Insertion order (Toxin, Heat, Cold) would combine Toxin+Heat
    // into Gas; slot order (Toxin, Cold, Heat) gives Viral + Heat.
    const placed: Partial<Record<SlotId, PlacedMod>> = {}
    placed["normal-0"] = mod("Infected Clip")
    placed["normal-2"] = mod("Hellfire")
    placed["normal-1"] = mod("Deep Freeze")
    expect(placedModsInSlotOrder(placed).map((p) => p.mod.name)).toEqual([
      "Infected Clip",
      "Deep Freeze",
      "Hellfire",
    ])
  })

  it("puts aura/stance/exilus before normal slots in reading order", () => {
    const placed: Partial<Record<SlotId, PlacedMod>> = {}
    placed["normal-7"] = mod("D")
    placed["exilus"] = mod("C")
    placed["aura-1"] = mod("B2")
    placed["stance"] = mod("B1")
    placed["normal-0"] = mod("E")
    placed["aura-0"] = mod("A")
    expect(placedModsInSlotOrder(placed).map((p) => p.mod.name)).toEqual([
      "A",
      "B1",
      "C",
      "B2",
      "E",
      "D",
    ])
  })
})

describe("dropOrphanSlots", () => {
  it("drops a mod sitting in a slot the layout doesn't have", () => {
    // An old companion-weapon build saved when the editor still drew an exilus
    // slot: the exilus mod must not survive into capacity/endo/serialization.
    const seed: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": mod("Maul"),
      "normal-1": mod("Bite"),
      exilus: mod("Hunter Synergy"),
    }
    const out = dropOrphanSlots(seed, COMPANION_WEAPON)
    expect(Object.keys(out).sort()).toEqual(["normal-0", "normal-1"])
    expect(out.exilus).toBeUndefined()
  })

  it("returns the same object when every slot is valid (no needless churn)", () => {
    const seed: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": mod("Maul"),
      "normal-7": mod("Bite"),
    }
    expect(dropOrphanSlots(seed, COMPANION_WEAPON)).toBe(seed)
  })

  it("keeps the stance slot for a beast-claw layout that has one", () => {
    const beastClaw: SlotLayout = { ...COMPANION_WEAPON, showStance: true }
    const seed: Partial<Record<SlotId, PlacedMod>> = {
      stance: mod("Assassin Posture"),
      "normal-0": mod("Maul"),
    }
    expect(dropOrphanSlots(seed, beastClaw)).toBe(seed)
  })

  it("drops orphaned forma polarities the same way", () => {
    const seed: Partial<Record<SlotId, Polarity>> = {
      "normal-0": "madurai",
      exilus: "naramon",
    }
    const out = dropOrphanSlots(seed, COMPANION_WEAPON)
    expect(out).toEqual({ "normal-0": "madurai" })
  })
})
