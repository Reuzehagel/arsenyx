import { describe, it, expect } from "bun:test"

import { applyStatCap, hasStatCap, getStatCap } from "../stat-caps"

// =============================================================================
// applyStatCap() TESTS
// =============================================================================

describe("applyStatCap", () => {
  it("caps ability efficiency at 175%", () => {
    const result = applyStatCap("ability_efficiency", 200)
    expect(result.value).toBe(175)
    expect(result.wasCapped).toBe(true)
    expect(result.uncapped).toBe(200)
  })

  it("floors ability efficiency at 25%", () => {
    const result = applyStatCap("ability_efficiency", 10)
    expect(result.value).toBe(25)
    expect(result.wasCapped).toBe(true)
    expect(result.uncapped).toBe(10)
  })

  it("does not cap efficiency within range", () => {
    const result = applyStatCap("ability_efficiency", 130)
    expect(result.value).toBe(130)
    expect(result.wasCapped).toBe(false)
    expect(result.uncapped).toBeUndefined()
  })

  it("floors ability duration at 12.5%", () => {
    const result = applyStatCap("ability_duration", 5)
    expect(result.value).toBe(12.5)
    expect(result.wasCapped).toBe(true)
  })

  it("does not cap duration above minimum", () => {
    const result = applyStatCap("ability_duration", 200)
    expect(result.value).toBe(200)
    expect(result.wasCapped).toBe(false)
  })

  it("floors ability range at 34%", () => {
    const result = applyStatCap("ability_range", 20)
    expect(result.value).toBe(34)
    expect(result.wasCapped).toBe(true)
  })

  it("passes through uncapped stat types unchanged", () => {
    const result = applyStatCap("health", 9999)
    expect(result.value).toBe(9999)
    expect(result.wasCapped).toBe(false)
  })

  it("passes through ability_strength unchanged (no cap defined)", () => {
    const result = applyStatCap("ability_strength", 500)
    expect(result.value).toBe(500)
    expect(result.wasCapped).toBe(false)
  })
})

// =============================================================================
// hasStatCap() TESTS
// =============================================================================

describe("hasStatCap", () => {
  it("returns true for ability_efficiency", () => {
    expect(hasStatCap("ability_efficiency")).toBe(true)
  })

  it("returns true for ability_duration", () => {
    expect(hasStatCap("ability_duration")).toBe(true)
  })

  it("returns true for ability_range", () => {
    expect(hasStatCap("ability_range")).toBe(true)
  })

  it("returns false for health", () => {
    expect(hasStatCap("health")).toBe(false)
  })

  it("returns false for ability_strength", () => {
    expect(hasStatCap("ability_strength")).toBe(false)
  })
})

// =============================================================================
// getStatCap() TESTS
// =============================================================================

describe("getStatCap", () => {
  it("returns cap for ability_efficiency", () => {
    const cap = getStatCap("ability_efficiency")
    expect(cap).toEqual({ min: 25, max: 175 })
  })

  it("returns cap for ability_duration (min only)", () => {
    const cap = getStatCap("ability_duration")
    expect(cap).toEqual({ min: 12.5 })
  })

  it("returns undefined for uncapped stat", () => {
    expect(getStatCap("health")).toBeUndefined()
  })
})
