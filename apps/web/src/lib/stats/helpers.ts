import { formatStat } from "@/lib/warframe"

import type { SourcedStat } from "./parser"
import type { StatContribution, StatType } from "./types"

export function round(v: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(v * f) / f
}

/** Sum the `flat_add` and `percent_add` contributions for a single stat type,
 *  returning the running totals plus the per-source contribution rows. The
 *  caller computes the modified value (typically `base * (1 + percent/100) +
 *  flat`); this only walks the stat list so the loop isn't duplicated. */
export function accumulate(
  statType: StatType,
  stats: SourcedStat[],
): { percent: number; flat: number; contributions: StatContribution[] } {
  const contributions: StatContribution[] = []
  let percent = 0
  let flat = 0
  for (const s of stats) {
    if (s.type !== statType) continue
    if (s.operation === "percent_add") {
      percent += s.value
      contributions.push({
        name: s.sourceName,
        amount: s.value,
        operation: "percent_add",
      })
    } else if (s.operation === "flat_add") {
      flat += s.value
      contributions.push({
        name: s.sourceName,
        amount: s.value,
        operation: "flat_add",
      })
    }
  }
  return { percent, flat, contributions }
}

export function formatWithSign(v: number, digits: number, unit = ""): string {
  return `${v >= 0 ? "+" : ""}${formatStat(v, digits)}${unit}`
}
