import { describe, it, expect } from "bun:test"

import { getModBaseName, areModsVariants } from "../mod-variants"

// =============================================================================
// getModBaseName() TESTS
// =============================================================================

describe("getModBaseName", () => {
  it("returns base name unchanged", () => {
    expect(getModBaseName("Serration")).toBe("Serration")
  })

  it("strips Primed prefix", () => {
    expect(getModBaseName("Primed Continuity")).toBe("Continuity")
  })

  it("strips Umbral prefix", () => {
    expect(getModBaseName("Umbral Vitality")).toBe("Vitality")
  })

  it("strips Sacrificial prefix", () => {
    expect(getModBaseName("Sacrificial Pressure")).toBe("Pressure")
  })

  it("strips Amalgam prefix", () => {
    expect(getModBaseName("Amalgam Serration")).toBe("Serration")
  })

  it("strips Archon prefix", () => {
    expect(getModBaseName("Archon Stretch")).toBe("Stretch")
  })

  it("strips Spectral prefix", () => {
    expect(getModBaseName("Spectral Scream")).toBe("Scream")
  })

  it("maps Galvanized Chamber to Split Chamber", () => {
    expect(getModBaseName("Galvanized Chamber")).toBe("Split Chamber")
  })

  it("maps Galvanized Diffusion to Barrel Diffusion", () => {
    expect(getModBaseName("Galvanized Diffusion")).toBe("Barrel Diffusion")
  })

  it("maps Galvanized Hell to Hell's Chamber", () => {
    expect(getModBaseName("Galvanized Hell")).toBe("Hell's Chamber")
  })

  it("only strips first matching prefix", () => {
    expect(getModBaseName("Primed Point Blank")).toBe("Point Blank")
  })
})

// =============================================================================
// areModsVariants() TESTS
// =============================================================================

describe("areModsVariants", () => {
  it("detects Primed variant conflict", () => {
    expect(
      areModsVariants({ name: "Continuity" }, { name: "Primed Continuity" }),
    ).toBe(true)
  })

  it("detects Umbral variant conflict", () => {
    expect(
      areModsVariants({ name: "Vitality" }, { name: "Umbral Vitality" }),
    ).toBe(true)
  })

  it("detects Galvanized replacement conflict", () => {
    expect(
      areModsVariants(
        { name: "Split Chamber" },
        { name: "Galvanized Chamber" },
      ),
    ).toBe(true)
  })

  it("returns false for unrelated mods", () => {
    expect(areModsVariants({ name: "Serration" }, { name: "Vitality" })).toBe(
      false,
    )
  })

  it("returns true for same mod", () => {
    expect(areModsVariants({ name: "Serration" }, { name: "Serration" })).toBe(
      true,
    )
  })
})
