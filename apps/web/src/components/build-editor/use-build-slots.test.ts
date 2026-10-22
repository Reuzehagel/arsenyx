import { createSyntheticRiven } from "@arsenyx/shared/warframe/rivens"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import {
  canBeAlternate,
  dropOrphanSlots,
  placedModsInSlotOrder,
  type PlacedMod,
  type SlotId,
  type SlotLayout,
  withAlternate,
  withAlternateRank,
  withoutAlternate,
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

function modWith(name: string, overrides: Partial<Mod>): Mod {
  return { ...mod(name).mod, ...overrides }
}

describe("canBeAlternate", () => {
  it("accepts a mod that passes the slot-kind check", () => {
    expect(canBeAlternate(mod("Point Blank").mod, "normal-0")).toBe(true)
  })

  it("rejects a mod that fails the slot-kind check", () => {
    const aura = modWith("Steel Charge", { compatName: "AURA" })
    expect(canBeAlternate(aura, "normal-0")).toBe(false)
    expect(canBeAlternate(mod("Point Blank").mod, "aura-0")).toBe(false)
    expect(canBeAlternate(aura, "aura-0")).toBe(true)
  })

  it("rejects the synthetic riven and configured rivens", () => {
    expect(canBeAlternate(createSyntheticRiven(), "normal-0")).toBe(false)
    const configured = modWith("Riven Mod", {
      uniqueName: "/Riven/stub",
      rarity: "Riven",
      rivenStats: { positives: [], negatives: [] },
    })
    expect(canBeAlternate(configured, "normal-0")).toBe(false)
  })
})

describe("alternate slot operations", () => {
  const base = (): Partial<Record<SlotId, PlacedMod>> => ({
    "normal-0": mod("Primed Point Blank"),
    "normal-1": mod("Blaze"),
  })

  it("sets an alternate at max rank without touching the slot's mod", () => {
    const placed = base()
    const next = withAlternate(placed, "normal-0", mod("Point Blank").mod)
    expect(next["normal-0"]?.mod.name).toBe("Primed Point Blank")
    expect(next["normal-0"]?.rank).toBe(5)
    expect(next["normal-0"]?.alternate?.mod.name).toBe("Point Blank")
    expect(next["normal-0"]?.alternate?.rank).toBe(5)
    expect(next["normal-1"]).toBe(placed["normal-1"])
  })

  it("keeps an explicit alternate rank, clamped to the mod's max", () => {
    const next = withAlternate(base(), "normal-0", mod("Point Blank").mod, 2)
    expect(next["normal-0"]?.alternate?.rank).toBe(2)
    const over = withAlternate(base(), "normal-0", mod("Point Blank").mod, 99)
    expect(over["normal-0"]?.alternate?.rank).toBe(5)
  })

  it("is a no-op on an empty slot or for an illegal alternate", () => {
    const placed = base()
    expect(withAlternate(placed, "normal-5", mod("Point Blank").mod)).toBe(
      placed,
    )
    expect(withAlternate(placed, "normal-0", createSyntheticRiven())).toBe(
      placed,
    )
  })

  it("removes the alternate and leaves the slot's mod", () => {
    const withAlt = withAlternate(base(), "normal-0", mod("Point Blank").mod)
    const next = withoutAlternate(withAlt, "normal-0")
    expect(next["normal-0"]?.alternate).toBeUndefined()
    expect("alternate" in (next["normal-0"] ?? {})).toBe(false)
    expect(next["normal-0"]?.mod.name).toBe("Primed Point Blank")
    // Nothing to remove → same reference.
    expect(withoutAlternate(next, "normal-0")).toBe(next)
  })

  it("sets the alternate's rank independently of the slot's rank", () => {
    const withAlt = withAlternate(base(), "normal-0", mod("Point Blank").mod)
    const next = withAlternateRank(withAlt, "normal-0", 1)
    expect(next["normal-0"]?.alternate?.rank).toBe(1)
    expect(next["normal-0"]?.rank).toBe(5)
    expect(
      withAlternateRank(next, "normal-0", -3)["normal-0"]?.alternate?.rank,
    ).toBe(0)
    expect(withAlternateRank(next, "normal-1", 1)).toBe(next)
  })
})
