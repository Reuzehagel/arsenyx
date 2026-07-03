import { describe, expect, it } from "bun:test"

import { modPoolsForCompanion, subTypeOf } from "./merge-companions"

// Regression guard: subTypeOf must route on the wiki `Type` field. Switching
// on `Category` (the old bug) lumped every MOA and Hound into "beast".
describe("subTypeOf", () => {
  it("classifies each robotic companion kind distinctly", () => {
    expect(subTypeOf("Sentinel")).toBe("sentinel")
    expect(subTypeOf("MOA")).toBe("moa")
    expect(subTypeOf("Hound")).toBe("hound")
  })

  it("classifies beast breeds as beast", () => {
    for (const t of ["Kavat", "Kubrow", "Vulpaphyla", "Predasite"]) {
      expect(subTypeOf(t)).toBe("beast")
    }
  })

  it("is case-insensitive and defaults unknown/undefined to beast", () => {
    expect(subTypeOf("moa")).toBe("moa")
    expect(subTypeOf(undefined)).toBe("beast")
    expect(subTypeOf("???")).toBe("beast")
  })
})

describe("modPoolsForCompanion", () => {
  it("gives sentinels the shared ROBOTIC pool (Vacuum, Guardian, Medi-Ray)", () => {
    // Sentinels are robotic companions — issue #258: Diriga was missing
    // Manifold Bond / Vacuum because it lacked ROBOTIC.
    const pools = modPoolsForCompanion("Diriga", "sentinel", "Sentinel")
    expect(pools).toEqual(["COMPANION", "Diriga", "Sentinel", "ROBOTIC"])
  })

  it("routes generic Kavat / Kubrow mods to the matching breed", () => {
    expect(modPoolsForCompanion("Smeeta Kavat", "beast", "Kavat")).toContain(
      "Kavat",
    )
    expect(modPoolsForCompanion("Sahasa Kubrow", "beast", "Kubrow")).toContain(
      "Kubrow",
    )
  })

  it("gives Vulpaphyla both the Kavat pool and their own precept pool", () => {
    // Vulpaphyla are infested catbrows: Tek set (Kavat) + Martyr Symbiosis
    // (VULPAPHYLA). Predasites mirror this on the Kubrow side.
    const vulp = modPoolsForCompanion("Sly Vulpaphyla", "beast", "Vulpaphyla")
    expect(vulp).toContain("Kavat")
    expect(vulp).toContain("VULPAPHYLA")
    expect(vulp).not.toContain("Kubrow")

    const preda = modPoolsForCompanion("Medjay Predasite", "beast", "Predasite")
    expect(preda).toContain("Kubrow")
    expect(preda).toContain("PREDASITE")
    expect(preda).not.toContain("Kavat")
  })

  it("keeps MOAs and Hounds on Moa/Hound + ROBOTIC", () => {
    expect(modPoolsForCompanion("Lambeo Moa", "moa", "MOA")).toEqual([
      "COMPANION",
      "Lambeo Moa",
      "Moa",
      "ROBOTIC",
    ])
    expect(modPoolsForCompanion("Hec Hound", "hound", "Hound")).toContain(
      "ROBOTIC",
    )
  })

  it("adds the base name for Primes (augment routing)", () => {
    const pools = modPoolsForCompanion("Wyrm Prime", "sentinel", "Sentinel")
    expect(pools).toContain("Wyrm")
    expect(pools).toContain("ROBOTIC")
  })
})
