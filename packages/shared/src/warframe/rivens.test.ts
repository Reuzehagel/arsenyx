import { describe, expect, it } from "vitest"

import { getRivenStatsFor, isRivenEligible, isSplicedRivenStat } from "./rivens"

// Wiki: Rivens exist for Primary, Secondary, Melee, Arch-Guns, and Robotic
// (Sentinel/MOA/Hound) weapons — but NOT beast companion weapons or Arch-Melee.
describe("isRivenEligible", () => {
  it("allows standard weapon categories", () => {
    expect(isRivenEligible("primary", { displayClass: "Rifle" })).toBe(true)
    expect(isRivenEligible("secondary", { displayClass: "Pistol" })).toBe(true)
    expect(isRivenEligible("melee", { displayClass: "Polearm" })).toBe(true)
  })

  it("allows robotic companion weapons but NOT beast claws", () => {
    // Sentinel/MOA/Hound weapons (robotic) → eligible.
    expect(
      isRivenEligible("companion-weapons", { displayClass: "Rifle" }),
    ).toBe(true)
    expect(
      isRivenEligible("companion-weapons", { displayClass: "Glaive" }),
    ).toBe(true)
    // Beast claws (Kavat/Kubrow/Vulpaphyla/Predasite) → NOT eligible.
    expect(
      isRivenEligible("companion-weapons", { displayClass: "Claws (Beast)" }),
    ).toBe(false)
  })

  it("allows Arch-Guns but not other archwing-bucket items", () => {
    expect(isRivenEligible("archwing", { displayClass: "Archgun" })).toBe(true)
    expect(isRivenEligible("archwing", { displayClass: "Archmelee" })).toBe(
      false,
    )
    expect(isRivenEligible("archwing", { displayClass: "Archwing" })).toBe(
      false,
    )
  })

  it("denies frames and other categories", () => {
    expect(isRivenEligible("warframes", { displayClass: "Warframe" })).toBe(
      false,
    )
    expect(isRivenEligible("companions", {})).toBe(false)
  })
})

// Per the wiki's Spliced Values table: weakpoint/ammo stats are gun-only,
// heavy-attack/parry stats melee-only, Reload While Holstered not on Archguns.
describe("spliced riven stats", () => {
  it("splits spliced stats by weapon class", () => {
    const gun = getRivenStatsFor("primary")
    const melee = getRivenStatsFor("melee")
    const archgun = getRivenStatsFor("archwing")
    for (const list of [gun, melee, archgun]) {
      expect(list).toContain("Viral Damage")
      expect(list).toContain("Status Damage")
      expect(list).toContain("Damage vs. Techrot")
    }
    expect(gun).toContain("Weakpoint Critical Chance")
    expect(melee).not.toContain("Weakpoint Damage")
    expect(melee).toContain("Parry Angle")
    expect(gun).not.toContain("Slam Attack Damage")
    expect(gun).toContain("Reload While Holstered")
    expect(archgun).not.toContain("Reload While Holstered")
    expect(archgun).toContain("Ammo Efficiency")
  })

  it("flags only spliced stats", () => {
    expect(isSplicedRivenStat("Magnetic Damage")).toBe(true)
    expect(isSplicedRivenStat("Damage")).toBe(false)
  })
})
