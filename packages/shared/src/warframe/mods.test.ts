import { describe, expect, it } from "vitest"

import { getModSetCode, isStanceMod } from "./mods"

describe("isStanceMod", () => {
  // The build emits stance mods with type "Stance" (singular, like
  // "Primary"/"Melee") — NOT "Stance Mod". This is the contract that broke
  // the stance picker; pin it against the real emitted value.
  it("matches the real emitted type 'Stance'", () => {
    expect(isStanceMod({ type: "Stance" })).toBe(true)
  })

  it("does not match the old fabricated 'Stance Mod' value", () => {
    expect(isStanceMod({ type: "Stance Mod" })).toBe(false)
  })

  it("does not match non-stance mods", () => {
    expect(isStanceMod({ type: "Melee" })).toBe(false)
    expect(isStanceMod({ type: "" })).toBe(false)
  })
})

describe("getModSetCode", () => {
  it("pulls the set segment out of a modSet path", () => {
    expect(
      getModSetCode({
        modSet: "/Lotus/Upgrades/Mods/Sets/Augur/AugurSetMod",
      }),
    ).toBe("Augur")
  })

  it("returns null when the mod isn't part of a set", () => {
    expect(getModSetCode({ modSet: undefined })).toBeNull()
  })

  it("returns null when the path has no /Sets/ segment", () => {
    // Defensive: a malformed path shouldn't crash the badge resolver.
    expect(
      getModSetCode({ modSet: "/Lotus/Upgrades/Mods/Warframe/Whatever" }),
    ).toBeNull()
  })
})
