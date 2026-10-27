import { INCARNON_EVOLUTIONS } from "@arsenyx/shared/warframe/incarnon-evolutions"
import { describe, expect, it } from "vitest"

import { incarnonPerkStats, parseIncarnonPerkStats } from "./incarnon"

describe("parseIncarnonPerkStats", () => {
  it("reads Base perks as base_add, ignoring variant notes", () => {
    expect(
      parseIncarnonPerkStats(
        "+16% Base Critical Chance (Braton), +0.4x Base Critical Damage Multiplier.",
      ),
    ).toEqual([
      { type: "critical_chance", value: 16, operation: "base_add" },
      { type: "critical_multiplier", value: 0.4, operation: "base_add" },
    ])
  })

  it("reads plain percents as mod-pool bonuses; reload skips the form", () => {
    expect(parseIncarnonPerkStats("+50% Reload Speed.")).toEqual([
      {
        type: "reload_speed",
        value: 50,
        operation: "percent_add",
        attackScope: "normal",
      },
    ])
  })

  it("keeps the unconditional part and drops the conditional rider", () => {
    expect(
      parseIncarnonPerkStats(
        "+24 Base Damage (Braton). With Channeled Ability active: +30 additional Damage and +50% Ammo Efficiency.",
      ),
    ).toEqual([{ type: "damage", value: 24, operation: "base_add" }])
    expect(parseIncarnonPerkStats("+40% Accuracy while aiming.")).toEqual([])
    expect(
      parseIncarnonPerkStats(
        "On Reload From Empty: +10 Base Magazine Capacity, stacking up to 3x.",
      ),
    ).toEqual([])
  })

  it("reads nameless and doubled Incarnon Form values from the previous stat", () => {
    const status = (value: number, attackScope: "normal" | "incarnon") => ({
      type: "status_chance",
      value,
      operation: "base_add",
      attackScope,
    })
    // Strun: the unscoped value no longer reaches the form.
    expect(
      parseIncarnonPerkStats(
        "+11% Base Status Chance; +132% in Incarnon Form.",
      ),
    ).toEqual([status(11, "normal"), status(132, "incarnon")])
    // Boar Survivor's Edge: slash form.
    expect(
      parseIncarnonPerkStats(
        "+10% Base Critical Chance; +6% Base Status Chance per projectile / +48% for Incarnon Form.",
      ),
    ).toEqual([
      { type: "critical_chance", value: 10, operation: "base_add" },
      status(6, "normal"),
      status(48, "incarnon"),
    ])
    // Sybaris / Stug.
    expect(
      parseIncarnonPerkStats(
        "+15% Base Status Chance (Sybaris); effect doubles in Incarnon Form.",
      ),
    ).toEqual([status(15, "normal"), status(30, "incarnon")])
  })

  it("scopes per-projectile and Incarnon Form status", () => {
    expect(
      parseIncarnonPerkStats(
        "+12% Base Status Chance per projectile; +96% Base Status Chance for Incarnon Form.",
      ),
    ).toEqual([
      {
        type: "status_chance",
        value: 12,
        operation: "base_add",
        attackScope: "normal",
      },
      {
        type: "status_chance",
        value: 96,
        operation: "base_add",
        attackScope: "incarnon",
      },
    ])
  })
})

it("tags stats with the picked perk name", () => {
  const stats = incarnonPerkStats(
    INCARNON_EVOLUTIONS.Braton,
    [null, null, null, "Survivor's Edge"],
    "Braton",
  )
  expect(stats.map((s) => [s.sourceName, s.type, s.value])).toEqual([
    ["Survivor's Edge", "critical_chance", 10],
    ["Survivor's Edge", "status_chance", 12],
  ])
})

// Every perk the stat engine reads, one line each, so a parser or data change
// shows its blast radius as a snapshot diff. Accept an intended change with
// `bun --filter=arsenyx-web run test -u`.
it("parses every evolution perk the way the snapshot says", async () => {
  const lines: string[] = []
  for (const [weapon, evo] of Object.entries(INCARNON_EVOLUTIONS)) {
    for (const tier of evo.tiers.slice(1)) {
      for (const perk of tier.perks) {
        const descs = [
          [weapon, perk.description],
          ...Object.entries(perk.variants ?? {}),
        ]
        for (const [name, desc] of descs) {
          const stats = parseIncarnonPerkStats(desc)
          const out = stats.length
            ? stats
                .map(
                  (s) =>
                    `${s.type} ${s.operation} ${s.value}${s.attackScope ? ` (${s.attackScope})` : ""}`,
                )
                .join(" | ")
            : "—"
          lines.push(`${name} T${tier.tier} ${perk.name} | ${out}`)
        }
      }
    }
  }
  await expect(lines.join("\n") + "\n").toMatchFileSnapshot(
    "./incarnon-catalog.snap.txt",
  )
})
