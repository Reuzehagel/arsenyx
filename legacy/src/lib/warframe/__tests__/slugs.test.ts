import { describe, it, expect } from "bun:test"

import { slugify, unslugify, getItemUrl, normalizeCategory } from "../slugs"

// =============================================================================
// slugify() TESTS
// =============================================================================

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Excalibur Prime")).toBe("excalibur-prime")
  })

  it("handles MK1 prefix", () => {
    expect(slugify("MK1-Braton")).toBe("mk1-braton")
  })

  it("removes apostrophes", () => {
    expect(slugify("Hell's Chamber")).toBe("hells-chamber")
  })

  it("removes curly apostrophes", () => {
    expect(slugify("Hell\u2019s Chamber")).toBe("hell-s-chamber")
  })

  it("replaces ampersand with 'and'", () => {
    expect(slugify("Rest & Rage")).toBe("rest-and-rage")
  })

  it("removes special characters", () => {
    expect(slugify("Cyte-09")).toBe("cyte-09")
  })

  it("collapses multiple hyphens", () => {
    expect(slugify("Kuva   Bramma")).toBe("kuva-bramma")
  })

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  Braton  ")).toBe("braton")
  })

  it("handles single word", () => {
    expect(slugify("Rhino")).toBe("rhino")
  })

  it("handles parentheses", () => {
    expect(slugify("Lato (Vandal)")).toBe("lato-vandal")
  })
})

// =============================================================================
// unslugify() TESTS
// =============================================================================

describe("unslugify", () => {
  it("replaces hyphens with spaces", () => {
    expect(unslugify("excalibur-prime")).toBe("excalibur prime")
  })

  it("handles single word", () => {
    expect(unslugify("rhino")).toBe("rhino")
  })
})

// =============================================================================
// getItemUrl() TESTS
// =============================================================================

describe("getItemUrl", () => {
  it("builds browse URL", () => {
    expect(getItemUrl("warframes", "excalibur-prime")).toBe(
      "/browse/warframes/excalibur-prime",
    )
  })
})

// =============================================================================
// normalizeCategory() TESTS
// =============================================================================

describe("normalizeCategory", () => {
  it("lowercases category", () => {
    expect(normalizeCategory("Warframes")).toBe("warframes")
  })

  it("preserves already-lowercase", () => {
    expect(normalizeCategory("melee")).toBe("melee")
  })
})
