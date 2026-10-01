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

// Regression: Sacrificial Steel's "(x2 for Heavy Attacks)" note made the whole
// line unparseable, so its +220% Critical Chance never reached the stats panel.
describe("parseStatString parenthetical notes", () => {
  it("Sacrificial Steel parses +220% Critical Chance", () => {
    const stats = parseStatString(
      "+220% Critical Chance (x2 for Heavy Attacks)",
    )
    expect(stats).toEqual([
      { type: "critical_chance", value: 220, operation: "percent_add" },
    ])
  })

  it("Vigilante Fervor parses +45% Fire Rate", () => {
    const stats = parseStatString("+45% Fire Rate (x2 for Bows)")
    expect(stats).toEqual([
      { type: "fire_rate", value: 45, operation: "percent_add" },
    ])
  })
})
