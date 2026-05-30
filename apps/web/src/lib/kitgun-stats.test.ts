import type { Gun, ModularKitguns } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { adjustChamberForKitgun } from "./kitgun-stats"

const MODULAR: ModularKitguns = {
  primary: {
    Sporelacer: {
      critChance: 0.21,
      critMultiplier: 2,
      statusChance: 0.21,
      magazine: { High: 11, Med: 9 },
      grips: {
        Tremor: {
          fireRate: 3,
          attacks: [
            { name: "Normal Attack", damage: { impact: 127 } },
            { name: "Explosion", damage: { toxin: 175 } },
          ],
        },
      },
    },
  },
  secondary: {},
  loaders: {
    Splat: {
      critChance: 0.14,
      critMultiplier: 0.3,
      statusChance: -0.08,
      reload: 1.7,
      magazine: "High",
    },
  },
}

// Catalog chamber: zero-stat shell. "Bomblet Impact" is an extra mode the
// modular data carries no damage for — the adjuster should drop it.
const CHAMBER: Gun = {
  uniqueName: "/x/Sporelacer",
  name: "Sporelacer (Primary)",
  tradable: false,
  attacks: [
    {
      name: "Normal Attack",
      crit_chance: 0,
      crit_mult: 0,
      status_chance: 0,
      speed: 0,
    },
    {
      name: "Explosion",
      crit_chance: 0,
      crit_mult: 0,
      status_chance: 0,
      speed: 0,
    },
    {
      name: "Bomblet Impact",
      crit_chance: 0,
      crit_mult: 0,
      status_chance: 0,
      speed: 0,
    },
  ],
}

describe("adjustChamberForKitgun", () => {
  it("reconstructs the verified Sporelacer Primary + Tremor + Splat combo", () => {
    const out = adjustChamberForKitgun(
      CHAMBER,
      "Sporelacer",
      "primary",
      "Tremor",
      "Splat",
      MODULAR,
    )
    // crit/status as integer percents; mult/fireRate raw.
    for (const a of out.attacks!) {
      expect(a.crit_chance).toBeCloseTo(35)
      expect(a.crit_mult).toBeCloseTo(2.3)
      expect(a.status_chance).toBeCloseTo(13)
      expect(a.speed).toBe(3)
    }
    // "Bomblet Impact" has no source damage → dropped; only the two real modes remain.
    expect(out.attacks!.map((a) => a.name)).toEqual([
      "Normal Attack",
      "Explosion",
    ])
    expect(out.attacks![0]!.damage).toEqual({ impact: 127 })
    expect(out.attacks![1]!.damage).toEqual({ toxin: 175 })
    expect(out.magazineSize).toBe(11)
    expect(out.reloadTime).toBe(1.7)
  })

  it("returns the weapon unchanged when data is missing or chamber unknown", () => {
    expect(
      adjustChamberForKitgun(
        CHAMBER,
        "Sporelacer",
        "primary",
        "Tremor",
        "Splat",
        undefined,
      ),
    ).toBe(CHAMBER)
    expect(
      adjustChamberForKitgun(
        CHAMBER,
        "Nope",
        "primary",
        "Tremor",
        "Splat",
        MODULAR,
      ),
    ).toBe(CHAMBER)
    expect(
      adjustChamberForKitgun(
        CHAMBER,
        "Sporelacer",
        "primary",
        "BadGrip",
        "Splat",
        MODULAR,
      ),
    ).toBe(CHAMBER)
  })
})
