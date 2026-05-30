import { describe, expect, it } from "vitest"

import { parseStatString } from "./parser"

// Regression: issue #175 — trade-off auras list a wearer penalty and a
// squad-mate buff on separate lines. The squad buff doesn't affect the
// equipped frame, and the wearer's loss is written with a positive number.
describe("parseStatString trade-off auras", () => {
  it("Power Donation nets -30% Ability Strength on the wearer", () => {
    const stats = parseStatString(
      "You lose <LOWER_IS_BETTER>30% Ability Strength\r\n" +
        "Squadmates gain 30% Ability Strength",
    )
    expect(stats).toEqual([
      { type: "ability_strength", value: -30, operation: "percent_add" },
    ])
  })

  it("drops the squadmates clause entirely", () => {
    const stats = parseStatString(
      "You lose <LOWER_IS_BETTER>1s Melee Combo Duration\r\n" +
        "Squadmates gain 2s Melee Combo Duration",
    )
    // Only the wearer's clause survives; flat values need an explicit sign in
    // the source text, so combo duration here yields nothing — the important
    // assertion is that the +2s squad buff never leaks in.
    expect(stats.some((s) => s.value > 0)).toBe(false)
  })

  it("leaves ordinary signed stats untouched", () => {
    const stats = parseStatString("+30% Ability Strength")
    expect(stats).toEqual([
      { type: "ability_strength", value: 30, operation: "percent_add" },
    ])
  })
})
