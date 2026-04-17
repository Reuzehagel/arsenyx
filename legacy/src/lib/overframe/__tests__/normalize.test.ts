import { describe, it, expect } from "bun:test"

import { normalizeName, expandNameVariants, similarity } from "../normalize"

// =============================================================================
// normalizeName
// =============================================================================

describe("normalizeName", () => {
  it("lowercases input", () => {
    expect(normalizeName("Serration")).toBe("serration")
  })

  it("strips diacritics", () => {
    expect(normalizeName("Déconstruction")).toBe("deconstruction")
  })

  it("replaces & with and", () => {
    expect(normalizeName("Bite & Bleed")).toBe("bite and bleed")
  })

  it("strips apostrophes and smart quotes", () => {
    expect(normalizeName("Hunter's Munitions")).toBe("hunters munitions")
    expect(normalizeName("Hunter\u2019s Munitions")).toBe("hunters munitions")
  })

  it("collapses non-alphanumeric to single spaces", () => {
    expect(normalizeName("Mod---Name!!!v2")).toBe("mod name v2")
  })

  it("trims leading and trailing whitespace", () => {
    expect(normalizeName("  Serration  ")).toBe("serration")
  })

  it("collapses multiple spaces", () => {
    expect(normalizeName("Primed   Continuity")).toBe("primed continuity")
  })

  it("handles empty string", () => {
    expect(normalizeName("")).toBe("")
  })
})

// =============================================================================
// expandNameVariants
// =============================================================================

describe("expandNameVariants", () => {
  it("returns the original name as a variant", () => {
    const variants = expandNameVariants("Serration")
    expect(variants).toContain("Serration")
  })

  it("expands parenthetical prefix like Continuity (Primed)", () => {
    const variants = expandNameVariants("Continuity (Primed)")
    expect(variants).toContain("Continuity (Primed)")
    expect(variants).toContain("Primed Continuity")
    expect(variants).toContain("Continuity Primed")
  })

  it("replaces hyphens with spaces", () => {
    const variants = expandNameVariants("Split-Chamber")
    expect(variants).toContain("Split Chamber")
  })

  it("handles names without parentheses", () => {
    const variants = expandNameVariants("Serration")
    expect(variants.length).toBeGreaterThanOrEqual(1)
    expect(variants).toContain("Serration")
  })

  it("deduplicates identical variants", () => {
    const variants = expandNameVariants("Simple Name")
    const unique = new Set(variants)
    expect(variants.length).toBe(unique.size)
  })
})

// =============================================================================
// similarity
// =============================================================================

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("Serration", "Serration")).toBe(1)
  })

  it("returns 1 for case-different but normalized-identical strings", () => {
    expect(similarity("serration", "SERRATION")).toBe(1)
  })

  it("returns 0 for empty vs non-empty", () => {
    expect(similarity("", "Serration")).toBe(0)
    expect(similarity("Serration", "")).toBe(0)
  })

  it("returns high similarity for close matches", () => {
    // "serration" vs "serraton" — 1 char difference in 9 chars
    const score = similarity("Serration", "Serraton")
    expect(score).toBeGreaterThan(0.8)
  })

  it("returns low similarity for very different strings", () => {
    const score = similarity("Serration", "Redirection")
    expect(score).toBeLessThan(0.7)
  })

  it("ignores diacritics in similarity comparison", () => {
    expect(similarity("Déconstruction", "Deconstruction")).toBe(1)
  })

  it("treats & and 'and' as equivalent", () => {
    expect(similarity("Bite & Bleed", "Bite and Bleed")).toBe(1)
  })
})
