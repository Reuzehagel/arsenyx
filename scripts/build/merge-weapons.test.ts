import { describe, expect, it } from "bun:test"

import { addNoAoePools } from "./merge-weapons"

describe("addNoAoePools", () => {
  const run = (pools: string[], tags?: string[]) => {
    const set = new Set(pools)
    addNoAoePools(set, tags)
    return [...set]
  }

  it("adds the No-Aoe variant to non-AoE rifle/pistol weapons", () => {
    // Untagged (Sporelacer-style) and non-AoE-tagged weapons both qualify.
    expect(run(["Pistol"])).toContain("Pistol (No Aoe)")
    expect(run(["Pistol"], ["PROJECTILE"])).toContain("Pistol (No Aoe)")
    expect(run(["Rifle"], ["HITSCAN"])).toContain("Rifle (No Aoe)")
  })

  it("withholds it from AoE-tagged weapons (case-insensitive)", () => {
    expect(run(["Pistol"], ["PROJECTILE", "AOE"])).not.toContain(
      "Pistol (No Aoe)",
    )
    expect(run(["Rifle"], ["aoe"])).not.toContain("Rifle (No Aoe)")
  })

  it("only touches rifle/pistol pools — shotguns have no No-Aoe pool", () => {
    expect(run(["Shotgun"])).toEqual(["Shotgun"])
    expect(run(["Melee"])).toEqual(["Melee"])
  })
})
