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

import {
  ExportUpgrades,
  ExportWeapons,
  type IUpgrade,
  type IWeapon,
} from "warframe-public-export-plus"

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
  /** Tags the equipped item must have AT LEAST ONE of for this mod to fit
   *  (e.g. `["SEMI_AUTO"]` on Semi-Rifle Cannonade). Game-client truth the
   *  `compatName`/`modPools` routing can't express — a Rifle mod that only
   *  fits semi-auto rifles. Refined against the weapon's own
   *  `compatibilityTags` in `getModsForItem`. */
  compatibilityTags?: string[]
  /** Tags the equipped item must have NONE of (e.g. `["GRNBOW", …]` on
   *  Split Flights, which excludes Grineer bows like the Kuva Bramma). */
  incompatibilityTags?: string[]
}

/** Build a `uniqueName → fields` lookup. Top-level shape of the OpenWF
 *  export is a keyed object (`uniqueName → IUpgrade`), so this is a
 *  near-trivial pluck. Only emits an entry when at least one field is
 *  present, keeping the map (and the merged mods) lean. */
export function readPePlusUpgrades(): Map<string, PePlusUpgradeFields> {
  const out = new Map<string, PePlusUpgradeFields>()
  for (const [uniqueName, entry] of Object.entries(
    ExportUpgrades as Record<string, IUpgrade>,
  )) {
    const fields: PePlusUpgradeFields = {}
    if (entry.compat) fields.compat = entry.compat
    if (entry.compatibilityTags?.length) {
      fields.compatibilityTags = entry.compatibilityTags
    }
    if (entry.incompatibilityTags?.length) {
      fields.incompatibilityTags = entry.incompatibilityTags
    }
    if (Object.keys(fields).length > 0) out.set(uniqueName, fields)
  }
  return out
}

/** `weapon uniqueName → compatibilityTags`. The game tags every weapon with
 *  intrinsic traits (`GRNBOW`, `SEMI_AUTO`, `PROJECTILE`, `BEAM`, …) that mod
 *  `compatibilityTags`/`incompatibilityTags` key off. Keyed by DE uniqueName,
 *  so it lines up with the emitted weapon items. Weapons without tags (or
 *  wiki-only weapons absent from this export) are simply omitted → the
 *  consumer treats a missing tag set as "no restriction". */
export function readPePlusWeaponTags(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [uniqueName, entry] of Object.entries(
    ExportWeapons as Record<string, IWeapon>,
  )) {
    if (entry.compatibilityTags?.length) {
      out.set(uniqueName, entry.compatibilityTags)
    }
  }
  return out
}
