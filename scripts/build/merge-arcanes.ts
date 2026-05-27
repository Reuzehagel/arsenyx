/**
 * Merge DE arcanes (filed under the misleadingly-named ExportRelicArcane
 * blob, sub-path `/Lotus/Upgrades/CosmeticEnhancers/`) into our normalized
 * shape.
 *
 * The plan flagged DE's choice: `ExportRelicArcane_en.json` carries both
 * Void Relics (~3000 entries) and Arcanes (~168 entries) in a flat
 * ExportRelicArcane array. We filter by the `/CosmeticEnhancers/` path
 * prefix to extract just the arcanes.
 *
 * `levelStats` is already pre-computed by DE (5 or 6 ranks worth of stat
 * strings per arcane) — no math here, just pass-through.
 *
 * Arcane "type" is derived from the sub-path (Offensive, Defensive,
 * Utility, OperatorAmps, OperatorArmour, Zariman). We map these to
 * user-facing categories the existing UI uses.
 */

import type { DeUpgrade } from "./read-de"

export interface MergedArcane {
  uniqueName: string
  name: string
  description?: string
  /** "Offensive" | "Defensive" | "Utility" | "Zariman" | "Amp" | "Operator" */
  type: string
  rarity: string
  imageName?: string
  levelStats?: Array<{ stats: string[] }>
  tradable: boolean
}

const RARITY_MAP: Record<string, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  LEGENDARY: "Legendary",
}

const SUBPATH_TO_TYPE: Record<string, string> = {
  Offensive: "Offensive",
  Defensive: "Defensive",
  Utility: "Utility",
  Zariman: "Zariman",
  OperatorAmps: "Amp",
  OperatorArmour: "Operator",
}

/** Filter DE's combined relic+arcane blob to just arcanes (by uniqueName
 *  prefix), then map to our shape. */
export function mergeArcanes(rawAll: DeUpgrade[]): MergedArcane[] {
  const out: MergedArcane[] = []
  for (const a of rawAll) {
    if (!a.uniqueName?.includes("/CosmeticEnhancers/")) continue
    if (!a.name) continue
    const subpath = a.uniqueName.split("/CosmeticEnhancers/")[1]?.split("/")[0]
    const type = SUBPATH_TO_TYPE[subpath ?? ""] ?? "Other"
    const rarity = a.rarity ? (RARITY_MAP[a.rarity] ?? a.rarity) : "Common"
    out.push({
      uniqueName: a.uniqueName,
      name: a.name,
      description: a.description,
      type,
      rarity,
      imageName: undefined, // resolved from ExportManifest at emit time
      levelStats: a.levelStats,
      tradable: true,
    })
  }
  return out
}
