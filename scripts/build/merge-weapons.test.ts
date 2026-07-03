import { describe, expect, it } from "bun:test"

import { addNoAoePools, addSlotWidePools } from "./merge-weapons"

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

describe("addSlotWidePools", () => {
  const run = (pools: string[]) => {
    const set = new Set(pools)
    addSlotWidePools(set)
    return [...set]
  }

  it("routes the PRIMARY slot-wide pool to every primary granular pool", () => {
    // Hunter Munitions / Vigilante set / Aero Periphery are compatName
    // "PRIMARY" — without this they'd match no rifle, shotgun, or bow.
    for (const p of ["Rifle", "Shotgun", "Sniper", "Bow"]) {
      expect(run([p])).toContain("PRIMARY")
    }
  })

  it("routes SECONDARY to pistol pools and MELEE to melee", () => {
    expect(run(["Pistol"])).toContain("SECONDARY")
    expect(run(["Thrown"])).toContain("SECONDARY")
    expect(run(["Melee"])).toContain("MELEE")
  })

  it("leaves companion/archwing pools untouched", () => {
    // Beast claws and arch weapons have their own routing — no slot-wide pool.
    expect(run(["BeastClaws", "BEAST"])).toEqual(["BeastClaws", "BEAST"])
    expect(run(["Archgun"])).toEqual(["Archgun"])
    expect(run(["Archmelee"])).toEqual(["Archmelee"])
  })

  it("appends at most one slot-wide pool per slot", () => {
    // A sniper rifle carries both "Rifle" and "Sniper" but earns a single
    // "PRIMARY" entry (Set-deduped).
    expect(
      run(["Rifle", "Sniper"]).filter((p) => p === "PRIMARY"),
    ).toHaveLength(1)
  })
})
