import { describe, expect, it } from "vitest"

import { getModSetCode } from "./mods"

describe("getModSetCode", () => {
  it("pulls the set segment out of a WFCD modSet path", () => {
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
