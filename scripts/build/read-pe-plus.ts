/**
 * Read OpenWF's `warframe-public-export-plus` package.
 *
 * DE's public-export endpoint omits several fields that exist in the game
 * client's internal data. The `warframe-public-export-plus` npm package
 * (github.com/calamity-inc/warframe-public-export-plus) extracts those raw
 * fields directly from the client and ships them as JSON. We pull only the
 * mod-routing field we need — `compat` (the specific item or class-anchor
 * path a mod targets). Stats, level scaling, polarity, etc. continue to
 * come from DE's raw `ExportUpgrades_en.json` so the source of truth for
 * numbers stays DE's public export.
 *
 * Risk model: OpenWF *extracts* additional raw fields rather than *deriving*
 * them. The augment-routing bug class that motivated this dep ("mod shows
 * up on items it can't equip on") is structurally impossible when `compat`
 * is the actual `uniqueName` DE uses internally — no string matching, no
 * inference.
 *
 * License note (2026-05): the upstream repo currently lacks a LICENSE file.
 * We treat the data as DE's IP (same as every other community Warframe
 * tool). If that ever becomes a problem, the snapshot lives in
 * `node_modules/warframe-public-export-plus/` and we can vendor it.
 */

import { ExportUpgrades, type IUpgrade } from "warframe-public-export-plus"

/** Mod-routing fields we lift from the OpenWF export. Everything else
 *  (stats, polarity, drain, rarity, …) comes from DE's raw export. */
export interface PePlusUpgradeFields {
  /** Specific item `uniqueName` for augments
   *  (e.g. `/Lotus/Weapons/.../ShrineMaidenNaginataWeapon`) or a generic
   *  class-anchor path for non-augment mods
   *  (e.g. `/Lotus/Weapons/Tenno/Melee/PlayerMeleeWeapon`). The merge
   *  step keeps both shapes; the filter pass in `build-items-index.ts`
   *  strips class anchors by intersecting against the live item set. */
  compat?: string
}

/** Build a `uniqueName → fields` lookup. Top-level shape of the OpenWF
 *  export is a keyed object (`uniqueName → IUpgrade`), so this is a
 *  near-trivial pluck. */
export function readPePlusUpgrades(): Map<string, PePlusUpgradeFields> {
  const out = new Map<string, PePlusUpgradeFields>()
  for (const [uniqueName, entry] of Object.entries(
    ExportUpgrades as Record<string, IUpgrade>,
  )) {
    const fields: PePlusUpgradeFields = {}
    if (entry.compat) fields.compat = entry.compat
    if (fields.compat) {
      out.set(uniqueName, fields)
    }
  }
  return out
}
