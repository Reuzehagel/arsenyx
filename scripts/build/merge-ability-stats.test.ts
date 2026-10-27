import { describe, expect, it } from "bun:test"

import { abilityStatsLookup } from "./merge-ability-stats"

const wiki = {
  "/Lotus/Powersuits/PowersuitAbilities/IcicleAbility": [
    {
      Label: "Cold Main Damage: |val1|",
      Modifier: "AVATAR_ABILITY_STRENGTH",
      Values: { Val1: 350 },
    },
    { Label: "Angle: |val1|xb0", Modifier: "NONE", Values: { Val1: 45 } },
    { Label: "Accuse" },
    {
      Label: "Damage Reduction: |val1|-|val2|%",
      Max: 90,
      HelminthMax: 75,
      Modifier: "AVATAR_ABILITY_STRENGTH",
      Values: { Val1: 40, Val2: 85 },
      HelminthValues: { Val1: 30 },
    },
    {
      InverseModifier: true,
      Label: "Energy Gain: |val1|%",
      Modifier: "AVATAR_ABILITY_EFFICIENCY",
      Values: { Val1: 25 },
    },
  ],
  "/Lotus/Powersuits/PowersuitAbilities/RhinoRoarAbility": [
    {
      Label: "Duration: |val1|s",
      Modifier: "AVATAR_ABILITY_DURATION",
      Values: { Val1: 30 },
    },
  ],
}

const freeze = {
  uniqueName: "/Lotus/Powersuits/Frost/Abilities/IcicleAbility",
  name: "Freeze",
}
const roar = {
  uniqueName: "/Lotus/Powersuits/Rhino/RhinoRoarAbility",
  name: "Roar",
}

describe("abilityStatsLookup", () => {
  const lookup = abilityStatsLookup(wiki, [freeze, roar])

  it("matches DE abilities to wiki entries by asset basename", () => {
    expect(lookup(freeze)).toEqual([
      { label: "Cold Main Damage: |val1|", scale: "strength", values: [350] },
      { label: "Angle: |val1|°", values: [45] },
      { label: "Accuse" },
      {
        label: "Damage Reduction: |val1|-|val2|%",
        scale: "strength",
        values: [40, 85],
        helminthValues: [30],
        max: 90,
        helminthMax: 75,
      },
    ])
  })

  it("falls back by name for a Prime with its own asset", () => {
    expect(
      lookup({
        uniqueName: "/Lotus/Powersuits/RhinoPrime/RoarPrimeAbility",
        name: "Roar",
      }),
    ).toEqual([{ label: "Duration: |val1|s", scale: "duration", values: [30] }])
  })

  it("skips the name fallback when two matched assets share a name", () => {
    const twoRoars = abilityStatsLookup(wiki, [
      roar,
      { uniqueName: "/X/IcicleAbility", name: "Roar" },
    ])
    expect(twoRoars({ uniqueName: "/Y/Other", name: "Roar" })).toBeUndefined()
  })

  it("fails on a wiki key it doesn't handle", () => {
    expect(() =>
      abilityStatsLookup(
        {
          "/A/NewAbility": [
            { Label: "X: |val1|", Values: { Val1: 1 }, Cap: 5 },
          ],
        },
        [],
      ),
    ).toThrow(/Unhandled ability stat key "Cap"/)
  })

  it("returns undefined for abilities the wiki lacks", () => {
    expect(lookup({ uniqueName: "/A/NewAbility", name: "New" })).toBeUndefined()
  })
})
