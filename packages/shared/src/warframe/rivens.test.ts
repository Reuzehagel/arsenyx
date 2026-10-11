import { describe, expect, it } from "vitest"

import { getRivenStatsFor, isRivenEligible } from "./rivens"

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

describe("Riven Splicing stats", () => {
  it("adds ranged-only traits to gun Rivens", () => {
    const stats = getRivenStatsFor("primary")

    expect(stats).toContain("Weakpoint Damage")
    expect(stats).toContain("Weakpoint Critical Chance")
    expect(stats).toContain("Ammo Efficiency")
    expect(stats).toContain("Magazine Reload While Holstered")
    expect(stats).toContain("Status Damage")
  })

  it("adds melee-only traits to melee Rivens", () => {
    const stats = getRivenStatsFor("melee")

    expect(stats).toContain("Heavy Attack Damage")
    expect(stats).toContain("Heavy Attack Windup Speed")
    expect(stats).toContain("Parry Angle")
    expect(stats).toContain("Slam Damage")
    expect(stats).toContain("Status Damage")
  })

  it("adds universal traits to both gun and melee Rivens", () => {
    const traits = [
      "Gas Damage",
      "Corrosive Damage",
      "Viral Damage",
      "Radiation Damage",
      "Blast Damage",
      "Magnetic Damage",
      "Damage vs Orokin",
      "Damage vs Techrot",
      "Damage vs Scaldra",
    ]

    for (const trait of traits) {
      expect(getRivenStatsFor("primary")).toContain(trait)
      expect(getRivenStatsFor("melee")).toContain(trait)
    }
  })

  it("keeps ranged and melee traits separated", () => {
    expect(getRivenStatsFor("melee")).not.toContain("Weakpoint Damage")
    expect(getRivenStatsFor("primary")).not.toContain("Heavy Attack Damage")
  })
})
