import { describe, expect, it } from "vitest"

import { isRivenEligible } from "./rivens"

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
