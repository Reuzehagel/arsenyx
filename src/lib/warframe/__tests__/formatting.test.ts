import { describe, it, expect } from "bun:test"

import {
  formatDisplayValue,
  formatContribution,
  formatPercent,
} from "../formatting"

// =============================================================================
// formatDisplayValue() TESTS
// =============================================================================

describe("formatDisplayValue", () => {
  describe("percent format", () => {
    it("formats whole number", () => {
      expect(formatDisplayValue(100, "percent")).toBe("100%")
    })

    it("formats decimal value", () => {
      expect(formatDisplayValue(12.5, "percent")).toBe("12.5%")
    })

    it("strips trailing .0", () => {
      expect(formatDisplayValue(50.0, "percent")).toBe("50%")
    })
  })

  describe("multiplier format", () => {
    it("formats whole number", () => {
      expect(formatDisplayValue(2, "multiplier")).toBe("2x")
    })

    it("formats decimal value", () => {
      expect(formatDisplayValue(2.5, "multiplier")).toBe("2.5x")
    })

    it("strips trailing .0", () => {
      expect(formatDisplayValue(3.0, "multiplier")).toBe("3x")
    })
  })

  describe("decimal format", () => {
    it("formats to 2 decimal places", () => {
      expect(formatDisplayValue(1.25, "decimal")).toBe("1.25")
    })

    it("strips trailing zeros", () => {
      expect(formatDisplayValue(1.5, "decimal")).toBe("1.5")
    })

    it("strips trailing dot and zeros", () => {
      expect(formatDisplayValue(3, "decimal")).toBe("3")
    })
  })

  describe("number format", () => {
    it("floors to integer", () => {
      expect(formatDisplayValue(742.8, "number")).toBe("742")
    })

    it("returns integer as-is", () => {
      expect(formatDisplayValue(300, "number")).toBe("300")
    })

    it("floors negative values", () => {
      expect(formatDisplayValue(-0.5, "number")).toBe("-1")
    })
  })
})

// =============================================================================
// formatContribution() TESTS
// =============================================================================

describe("formatContribution", () => {
  it("adds + prefix for positive percent", () => {
    expect(formatContribution(30, "percent")).toBe("+30%")
  })

  it("shows negative sign for negative percent", () => {
    expect(formatContribution(-15.5, "percent")).toBe("-15.5%")
  })

  it("adds + prefix for positive multiplier", () => {
    expect(formatContribution(2, "multiplier")).toBe("+2x")
  })

  it("adds + prefix for positive decimal", () => {
    expect(formatContribution(0.5, "decimal")).toBe("+0.5")
  })

  it("adds + prefix for positive number", () => {
    expect(formatContribution(100, "number")).toBe("+100")
  })

  it("floors number format", () => {
    expect(formatContribution(99.9, "number")).toBe("+99")
  })

  it("treats zero as positive (+ prefix)", () => {
    expect(formatContribution(0, "percent")).toBe("+0%")
  })
})

// =============================================================================
// formatPercent() TESTS
// =============================================================================

describe("formatPercent", () => {
  it("formats whole number", () => {
    expect(formatPercent(50)).toBe("50%")
  })

  it("formats decimal", () => {
    expect(formatPercent(12.5)).toBe("12.5%")
  })

  it("strips trailing .0", () => {
    expect(formatPercent(100.0)).toBe("100%")
  })
})
