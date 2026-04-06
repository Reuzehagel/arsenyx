import { describe, it, expect } from "bun:test"

import { mapOverframePolarityCode } from "../polarity"

describe("mapOverframePolarityCode", () => {
  it("maps code 0 to undefined polarity (no polarity), known", () => {
    const result = mapOverframePolarityCode(0)
    expect(result).toEqual({ code: 0, polarity: undefined, isKnown: true })
  })

  it("maps code 1 to madurai", () => {
    const result = mapOverframePolarityCode(1)
    expect(result).toEqual({ code: 1, polarity: "madurai", isKnown: true })
  })

  it("maps code 2 to vazarin", () => {
    const result = mapOverframePolarityCode(2)
    expect(result).toEqual({ code: 2, polarity: "vazarin", isKnown: true })
  })

  it("maps code 3 to naramon", () => {
    const result = mapOverframePolarityCode(3)
    expect(result).toEqual({ code: 3, polarity: "naramon", isKnown: true })
  })

  it("maps code 4 to zenurik", () => {
    const result = mapOverframePolarityCode(4)
    expect(result).toEqual({ code: 4, polarity: "zenurik", isKnown: true })
  })

  it("maps code 5 to unairu", () => {
    const result = mapOverframePolarityCode(5)
    expect(result).toEqual({ code: 5, polarity: "unairu", isKnown: true })
  })

  it("maps code 7 to penjaga", () => {
    const result = mapOverframePolarityCode(7)
    expect(result).toEqual({ code: 7, polarity: "penjaga", isKnown: true })
  })

  it("maps code 8 to umbra", () => {
    const result = mapOverframePolarityCode(8)
    expect(result).toEqual({ code: 8, polarity: "umbra", isKnown: true })
  })

  it("maps code 9 to any (universal forma)", () => {
    const result = mapOverframePolarityCode(9)
    expect(result).toEqual({ code: 9, polarity: "any", isKnown: true })
  })

  it("marks code 6 as unknown (gap in the map)", () => {
    const result = mapOverframePolarityCode(6)
    expect(result.code).toBe(6)
    expect(result.isKnown).toBe(false)
  })

  it("marks codes > 9 as unknown", () => {
    const result = mapOverframePolarityCode(10)
    expect(result.code).toBe(10)
    expect(result.isKnown).toBe(false)
  })

  it("handles null input", () => {
    const result = mapOverframePolarityCode(null)
    expect(result).toEqual({ code: null, isKnown: false })
  })

  it("handles undefined input", () => {
    const result = mapOverframePolarityCode(undefined)
    expect(result).toEqual({ code: null, isKnown: false })
  })

  it("handles NaN input", () => {
    const result = mapOverframePolarityCode(NaN)
    expect(result).toEqual({ code: null, isKnown: false })
  })
})
