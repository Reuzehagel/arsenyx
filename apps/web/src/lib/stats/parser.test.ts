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

// Regression: issue #393 — "+30% Multishot for 20s" ran the duration into the
// stat name, so Galvanized on-kill stacks (and ~60 other timed buffs) never
// parsed and the "Max stacks" toggle never appeared for them.
describe("parseStatString timed and stacking buffs", () => {
  it("Galvanized Chamber parses its on-kill stack", () => {
    const stats = parseStatString(
      "On Kill:\r\n+30% Multishot for 20s. Stacks up to 5x.",
    )
    expect(stats).toEqual([
      {
        type: "multishot",
        value: 30,
        operation: "percent_add",
        isConditional: true,
        maxStacks: 5,
        condition: "On Kill",
      },
    ])
  })

  it("splits two stats joined by 'and'", () => {
    const stats = parseStatString(
      "On Enemy Frozen: Gain +2% Ability Strength and +2% Ability Duration for 15s. Stacks up to 20x.",
    )
    expect(stats.map((s) => [s.type, s.maxStacks])).toEqual([
      ["ability_strength", 20],
      ["ability_duration", 20],
    ])
  })

  it("Cascadia Flare's percent cap becomes a stack count", () => {
    const [stat] = parseStatString(
      "On <DT_FIRE_COLOR>Heat Status Effect:\r\n+12% Damage for 10s. Stacks up to 480%.",
    )
    expect(stat.maxStacks).toBe(40)
  })

  it("a count that isn't a duration doesn't end the name", () => {
    // Magus Aggress: 'for 4 consecutive attacks' is not a timed buff.
    const stats = parseStatString(
      "On Warframe Melee Transference: Heavy Blades deal +300% Critical Damage for 4 consecutive attacks. Cooldown 20s.",
    )
    expect(stats).toEqual([])
  })

  it.each([
    "Killing enemies grants Allies within Affinity Range +30% Fire Rate for 15s.",
    "On Weak Point Hit:\r\n+300% Damage for 18s on Secondary Weapon",
    "Squad's Companions receive +300 Health and +180 Armor",
    "On aim: x0.2 explosion radius, +100% damage and +5.5% ammo efficiency for every 1m radius lost.",
  ])("drops buffs aimed elsewhere or scaled by the unmodeled: %s", (s) => {
    expect(parseStatString(s)).toEqual([])
  })

  it.each([
    "While invisible, gain +30% Ability Strength and +3x Final Critical Damage.",
    "On Headshot Kill:\r\n+30% Ability Efficiency and +30% Ability Strength on the next Ability used within 4s.",
  ])("marks trigger-gated buffs conditional: %s", (s) => {
    const stats = parseStatString(s)
    expect(stats.length).toBeGreaterThan(0)
    expect(stats.every((st) => st.isConditional)).toBe(true)
  })
})

// Merciless/Deadhead repeat their passive lines inside the on-kill string;
// without the dedupe the passive was counted twice and scaled by the stacks.
describe("parseModStats embedded passive lines", () => {
  it("Primary Merciless counts its reload passive once, unstacked", () => {
    const mod = {
      name: "Primary Merciless",
      levelStats: [
        {
          stats: [
            "On Kill:\r\n+30% Damage for 4s. Stacks up to 12x.\r\n+30% Reload Speed",
            "+30% Reload Speed",
          ],
        },
      ],
    } as unknown as Mod
    const stats = parseModStats({ mod, rank: 0 })
    expect(stats.filter((s) => s.type === "reload_speed")).toEqual([
      { type: "reload_speed", value: 30, operation: "percent_add" },
    ])
    expect(stats.find((s) => s.type === "damage")?.maxStacks).toBe(12)
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
