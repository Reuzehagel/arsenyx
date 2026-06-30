import { describe, expect, it } from "bun:test"

import { mergeModular } from "./merge-modular"

// Minimal slice of Module:Modular/data + the catalog weapon entries needed to
// exercise damage allocation across attack modes.
const MODULAR = {
  KitgunPrimary: {
    Chamber: {
      Sporelacer: {
        CritChance: 0.21,
        CritMultiplier: 2,
        StatusChance: 0.21,
        Magazine: { High: 11, Med: 9 },
        Damage: {
          Base: { Impact: 21, Toxin: 69 },
          Tremor: { Impact: 127, Toxin: 175 },
        },
        FireRate: { Tremor: 3 },
      },
      Tombfinger: {
        CritChance: 0.24,
        CritMultiplier: 2,
        StatusChance: 0.24,
        Magazine: { High: 23 },
        Damage: { Tremor: { Impact: 69, Radiation: 47 } },
        FireRate: { Tremor: 2.13 },
      },
    },
    Loader: {
      Splat: {
        CritChance: 0.14,
        CritMultiplier: 0.3,
        StatusChance: -0.08,
        Reload: 1.7,
        Magazine: "High",
      },
    },
  },
  Kitgun: { Chamber: {}, Loader: {} },
  Zaw: { Strike: {}, Grip: {}, Link: {} },
}

// Catalog weapon entries carry the attack-mode structure (zeroed damage, but
// the damage-type keys reveal which type belongs to which mode).
const WIKI = new Map<string, Record<string, unknown>>([
  [
    "Sporelacer (Primary)",
    {
      Attacks: [
        {
          AttackName: "Normal Attack",
          Damage: { Impact: 0, Puncture: 0, Slash: 0 },
        },
        { AttackName: "Explosion", Damage: { Toxin: 0 } },
      ],
    },
  ],
  [
    "Tombfinger (Primary)",
    {
      Attacks: [
        { AttackName: "Normal Attack", Damage: { Impact: 0, Radiation: 0 } },
        { AttackName: "Quick Shot Explosion", Damage: { Radiation: 0 } },
      ],
    },
  ],
])

describe("mergeModular", () => {
  const data = mergeModular(MODULAR, WIKI)
  const sporelacer = data.kitgun.primary.Sporelacer!
  const tremor = sporelacer.grips.Tremor!

  it("carries chamber base ratios and skips the synthetic 'Base' grip", () => {
    expect(sporelacer.critChance).toBe(0.21)
    expect(sporelacer.critMultiplier).toBe(2)
    expect(sporelacer.statusChance).toBe(0.21)
    expect(Object.keys(sporelacer.grips)).toEqual(["Tremor"])
  })

  it("allocates damage to the attack mode that declares each type", () => {
    expect(tremor.fireRate).toBe(3)
    expect(tremor.attacks).toEqual([
      { name: "Normal Attack", damage: { impact: 127 } },
      { name: "Explosion", damage: { toxin: 175 } },
    ])
  })

  it("drops attack modes with no reconstructable damage", () => {
    // Tombfinger's Radiation belongs to the Normal Attack (first declarer); the
    // explosion's separate magnitude isn't in any verifiable table, so the
    // explosion mode is dropped entirely rather than emitted as a misleading 0.
    const tf = data.kitgun.primary.Tombfinger!.grips.Tremor!
    expect(tf.attacks).toEqual([
      { name: "Normal Attack", damage: { impact: 69, radiation: 47 } },
    ])
  })

  it("emits loaders with additive modifiers and magazine tier", () => {
    expect(data.kitgun.loaders.Splat).toEqual({
      critChance: 0.14,
      critMultiplier: 0.3,
      statusChance: -0.08,
      reload: 1.7,
      magazine: "High",
    })
  })
})
