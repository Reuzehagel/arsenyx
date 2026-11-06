import { describe, expect, it, spyOn } from "bun:test"

import { POLARITIES } from "@arsenyx/shared/warframe/polarities"

import { normalizePolarities, normalizePolarity } from "./polarity"

describe("normalizePolarity", () => {
  it("lowercases recognized polarities", () => {
    expect(normalizePolarity("Madurai")).toBe("madurai")
    expect(normalizePolarity("NARAMON")).toBe("naramon")
    expect(normalizePolarity("Zenurik")).toBe("zenurik")
  })

  it("maps the wiki 'None' sentinel and empty/non-string values to null", () => {
    expect(normalizePolarity("None")).toBeNull()
    expect(normalizePolarity("none")).toBeNull()
    expect(normalizePolarity("")).toBeNull()
    expect(normalizePolarity(undefined)).toBeNull()
    expect(normalizePolarity(42)).toBeNull()
  })

  it("maps the wiki's 'Aura' spelling to the canonical Universal polarity", () => {
    // Dante / Protea aura slots and Vinquibus's normal + stance slots.
    expect(normalizePolarity("Aura")).toBe("any")
    expect(normalizePolarity("aura")).toBe("any")
    expect(normalizePolarities(["Madurai", "Aura"])).toEqual(["madurai", "any"])
  })

  it("passes an unrecognized polarity through verbatim (never drops/throws)", () => {
    expect(normalizePolarity("Mystery")).toBe("mystery")
  })

  it("accepts every shared polarity and the wiki-only 'exilus' silently", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {})
    try {
      for (const p of [...POLARITIES, "exilus"]) {
        const wikiSpelling = p.charAt(0).toUpperCase() + p.slice(1)
        expect(normalizePolarity(wikiSpelling)).toBe(p)
      }
      expect(warn).not.toHaveBeenCalled()
      normalizePolarity("Mystery")
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })
})
