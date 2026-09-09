/**
 * Backfill mods DE's PublicExport dropped but that are still in-game.
 * Curated records live in data/curated/de-missing-mods.ts; this splices
 * them into the raw `ExportUpgrades` list ahead of `mergeMods` so they take
 * the normal pipeline (polarity/rarity mapping, wiki flags, image resolve).
 */

import type { DeUpgrade } from "./read-de"

export interface InjectMissingResult {
  upgrades: DeUpgrade[]
  /** Curated records appended because DE lacks them. */
  injected: string[]
  /** Curated records DE ships again — skipped; the curated entry is stale. */
  resurfaced: string[]
}

export function injectMissingDeMods(
  raw: DeUpgrade[],
  missing: readonly DeUpgrade[],
): InjectMissingResult {
  const present = new Set(raw.map((u) => u.uniqueName))
  const injected: string[] = []
  const resurfaced: string[] = []
  const upgrades = [...raw]
  for (const mod of missing) {
    if (present.has(mod.uniqueName)) {
      resurfaced.push(mod.name)
      continue
    }
    upgrades.push(mod)
    injected.push(mod.name)
  }
  return { upgrades, injected, resurfaced }
}
