import {
  GUN_RIVEN_STATS,
  MELEE_RIVEN_STATS,
} from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { parseModStats, parseStatString } from "./parser"

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

// Riven stats the stat engine has no model for: they render on the card but
// parse to nothing. A riven stat whose name the parser doesn't recognise is
// dropped silently, so every stat the dialog offers must either parse or be
// listed here — adding one to the riven lists forces that decision.
const DISPLAY_ONLY_RIVEN_STATS = new Set([
  "Initial Combo",
  "Heavy Attack Efficiency",
  "Chance to Gain Combo Count",
  // Spliced (Update 44.1)
  "Status Damage",
  "Damage vs. Orokin",
  "Damage vs. Scaldra",
  "Damage vs. Techrot",
  "Ammo Efficiency",
  "Reload While Holstered",
  "Weakpoint Damage",
  "Weakpoint Critical Chance",
  "Heavy Attack Wind Up Speed",
  "Melee Damage On Heavy Attack",
  "Slam Attack Damage",
  "Parry Angle",
])

describe("riven stat coverage", () => {
  const allStats = [...new Set([...GUN_RIVEN_STATS, ...MELEE_RIVEN_STATS])]

  it.each(allStats)("%s parses unless listed as display-only", (stat) => {
    const riven = {
      name: "Riven Mod",
      rivenStats: { positives: [{ stat, value: 10 }], negatives: [] },
    } as unknown as Mod
    const parsed = parseModStats({ mod: riven, rank: 0 }).length > 0
    expect(parsed).toBe(!DISPLAY_ONLY_RIVEN_STATS.has(stat))
  })

  it("lists only stats the riven dialog offers", () => {
    for (const stat of DISPLAY_ONLY_RIVEN_STATS) {
      expect(allStats).toContain(stat)
    }
  })
})
