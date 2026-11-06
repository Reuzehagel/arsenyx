import { createSyntheticRiven } from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { canBeAlternate } from "./slot-kind"

function mod(name: string): { mod: Mod; rank: number } {
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
