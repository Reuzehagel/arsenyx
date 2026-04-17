import { describe, it, expect } from "bun:test"

import { getArcanesForCategory } from "../arcanes"

describe("getArcanesForCategory", () => {
  it("returns warframe arcanes for 'warframes'", () => {
    const result = getArcanesForCategory("warframes")
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((a) => a.name.includes("Arcane"))).toBe(true)
  })

  it("returns warframe arcanes for 'necramechs'", () => {
    const result = getArcanesForCategory("necramechs")
    expect(result).toEqual(getArcanesForCategory("warframes"))
  })

  it("returns primary + secondary arcanes for 'archwing'", () => {
    const result = getArcanesForCategory("archwing")
    expect(result.length).toBeGreaterThan(0)
  })

  it("returns primary arcanes for 'primary'", () => {
    const result = getArcanesForCategory("primary")
    expect(result.length).toBeGreaterThan(0)
  })

  it("returns secondary arcanes for 'secondary'", () => {
    const result = getArcanesForCategory("secondary")
    expect(result.length).toBeGreaterThan(0)
  })

  it("returns melee arcanes for 'melee'", () => {
    const result = getArcanesForCategory("melee")
    expect(result.length).toBeGreaterThan(0)
  })

  it("returns empty array for categories without arcanes", () => {
    const result = getArcanesForCategory("companions")
    expect(result).toEqual([])
  })

  it("returns empty array for 'companion-weapons'", () => {
    const result = getArcanesForCategory("companion-weapons")
    expect(result).toEqual([])
  })

  it("returns empty array for 'exalted-weapons'", () => {
    const result = getArcanesForCategory("exalted-weapons")
    expect(result).toEqual([])
  })
})
