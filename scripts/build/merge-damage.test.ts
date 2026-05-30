import { describe, expect, it } from "bun:test"

import { damageFromDePerShot } from "./merge-damage"

describe("damageFromDePerShot", () => {
  it("maps array indices to element names, dropping zeros", () => {
    const arr = new Array(20).fill(0)
    arr[0] = 100 // impact
    arr[3] = 50 // heat
    expect(damageFromDePerShot(arr)).toEqual({ impact: 100, heat: 50 })
  })

  it("index 19 is finisher (not 'true')", () => {
    const arr = new Array(20).fill(0)
    arr[19] = 1500
    expect(damageFromDePerShot(arr)).toEqual({ finisher: 1500 })
  })

  it("returns undefined for empty / all-zero / missing input", () => {
    expect(damageFromDePerShot(undefined)).toBeUndefined()
    expect(damageFromDePerShot([])).toBeUndefined()
    expect(damageFromDePerShot(new Array(20).fill(0))).toBeUndefined()
  })
})
