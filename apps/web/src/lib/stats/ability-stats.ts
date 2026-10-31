import type { AbilityStat } from "@arsenyx/shared/warframe/types"

import { formatStat } from "../warframe"
import type { WarframeStats } from "./types"

export type AbilityTotals = Pick<
  WarframeStats,
  "abilityStrength" | "abilityDuration" | "abilityRange" | "abilityEfficiency"
>

export interface AbilityStatRow {
  text: string
  /** Sub-heading row (e.g. one part of a multi-mode ability), no value. */
  heading?: boolean
  /** The build's mods moved this value off its base. */
  changed?: boolean
}

/** Multiplier one stat row gets from the build's totals (all in percent).
 *  Efficiency/drain formulas from wiki.warframe.com/w/Ability_Efficiency. */
function multiplier(stat: AbilityStat, t: AbilityTotals): number {
  switch (stat.scale) {
    case "strength":
      return t.abilityStrength.modified / 100
    case "duration":
      return t.abilityDuration.modified / 100
    case "range":
      return t.abilityRange.modified / 100
    case "efficiency":
      // Cast cost: base * (2 - efficiency), efficiency already capped 25–175%.
      return 2 - t.abilityEfficiency.modified / 100
    case "drain": {
      // Drain/s: base * (2 - uncapped efficiency) / duration, clamped 25–175%.
      const eff =
        (t.abilityEfficiency.uncapped ?? t.abilityEfficiency.modified) / 100
      const m = (2 - eff) / (t.abilityDuration.modified / 100)
      return Math.min(1.75, Math.max(0.25, m))
    }
    default:
      return 1
  }
}

export function abilityStatRows(
  stats: readonly AbilityStat[],
  totals: AbilityTotals,
  isHelminth = false,
): AbilityStatRow[] {
  return stats.map((stat) => {
    const base = (isHelminth && stat.helminthValues) || stat.values
    if (!base) return { text: stat.label, heading: true }
    const m = multiplier(stat, totals)
    const max = (isHelminth && stat.helminthMax) || stat.max
    let changed = false
    const text = stat.label.replace(/\|val(\d)\|/g, (whole, n: string) => {
      const b = base[Number(n) - 1]
      if (b === undefined) return whole
      let v = b * m
      if (max !== undefined) v = Math.min(max, v)
      if (stat.min !== undefined) v = Math.max(stat.min, v)
      if (Math.abs(v - b) > 1e-9) changed = true
      return formatStat(v, stat.round ?? 1)
    })
    return { text, changed }
  })
}
