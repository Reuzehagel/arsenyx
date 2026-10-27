import type { AbilityStat } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { abilityStatRows, type AbilityTotals } from "./ability-stats"
import type { StatValue } from "./types"

const v = (modified: number, uncapped?: number): StatValue => ({
  base: 100,
  modified,
  uncapped,
  contributions: [],
})

const totals = (
  strength: number,
  duration: number,
  range: number,
  efficiency: number,
  efficiencyUncapped?: number,
): AbilityTotals => ({
  abilityStrength: v(strength),
  abilityDuration: v(duration),
  abilityRange: v(range),
  abilityEfficiency: v(efficiency, efficiencyUncapped),
})

const row = (stat: AbilityStat, t: AbilityTotals, helminth = false) =>
  abilityStatRows([stat], t, helminth)[0]

describe("abilityStatRows", () => {
  it("scales strength/duration/range linearly", () => {
    const t = totals(200, 150, 50, 100)
    expect(
      row({ label: "Dmg: |val1|", scale: "strength", values: [350] }, t),
    ).toEqual({ text: "Dmg: 700", changed: true })
    expect(
      row({ label: "|val1|s", scale: "duration", values: [8] }, t).text,
    ).toBe("12s")
    expect(
      row({ label: "|val1|m", scale: "range", values: [15] }, t).text,
    ).toBe("7.5m")
  })

  it("lowers strength-scaled values below base and clamps to min", () => {
    const t = totals(70, 100, 100, 100)
    expect(
      row({ label: "|val1|", scale: "strength", values: [100] }, t),
    ).toEqual({ text: "70", changed: true })
    expect(
      row({ label: "|val1|", scale: "strength", values: [100], min: 80 }, t)
        .text,
    ).toBe("80")
  })

  it("falls back to the normal values for a subsumed ability without Helminth ones", () => {
    expect(
      row(
        { label: "|val1|", scale: "strength", values: [30] },
        totals(200, 100, 100, 100),
        true,
      ).text,
    ).toBe("60")
  })

  it("leaves fixed stats and unmodded builds unchanged", () => {
    expect(
      row({ label: "Cap: |val1|%", values: [50] }, totals(300, 100, 100, 100)),
    ).toEqual({ text: "Cap: 50%", changed: false })
  })

  it("applies cast cost as base * (2 - efficiency)", () => {
    const cost: AbilityStat = {
      label: "Cost: |val1|",
      scale: "efficiency",
      values: [100],
    }
    expect(row(cost, totals(100, 100, 100, 130)).text).toBe("Cost: 70")
    expect(row(cost, totals(100, 100, 100, 175)).text).toBe("Cost: 25")
  })

  it("applies drain as (2 - uncapped efficiency) / duration, clamped to 25-175%", () => {
    const drain: AbilityStat = {
      label: "|val1|/s",
      scale: "drain",
      values: [10],
    }
    expect(row(drain, totals(100, 200, 100, 130)).text).toBe("3.5/s")
    expect(row(drain, totals(100, 300, 100, 175, 205)).text).toBe("2.5/s")
    expect(row(drain, totals(100, 50, 100, 100)).text).toBe("17.5/s")
  })

  it("clamps to the wiki's max and fills two-value labels", () => {
    expect(
      row(
        {
          label: "DR: |val1|-|val2|%",
          scale: "strength",
          values: [40, 85],
          max: 90,
        },
        totals(200, 100, 100, 100),
      ).text,
    ).toBe("DR: 80-90%")
  })

  it("uses Helminth values when subsumed", () => {
    const stat: AbilityStat = {
      label: "|val1|%",
      scale: "strength",
      values: [50],
      helminthValues: [30],
    }
    expect(row(stat, totals(100, 100, 100, 100), true).text).toBe("30%")
  })

  it("caps a subsumed ability at its Helminth max (Eclipse 95% → 75%)", () => {
    const eclipse: AbilityStat = {
      label: "DR: |val1|%",
      scale: "strength",
      values: [75],
      max: 95,
      helminthMax: 75,
    }
    const t = totals(199, 100, 100, 100)
    expect(row(eclipse, t).text).toBe("DR: 95%")
    expect(row(eclipse, t, true).text).toBe("DR: 75%")
  })

  it("passes sub-headings through", () => {
    expect(row({ label: "Accuse" }, totals(100, 100, 100, 100))).toEqual({
      text: "Accuse",
      heading: true,
    })
  })
})
