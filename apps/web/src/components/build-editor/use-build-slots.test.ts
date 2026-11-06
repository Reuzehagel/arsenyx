import type { PlacedMod, SlotId } from "@arsenyx/shared/warframe/build-data"
import { createSyntheticRiven } from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import {
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
