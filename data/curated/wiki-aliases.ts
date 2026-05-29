/**
 * DE-name → Wiki-key alias map.
 *
 * Most weapons match by exact name between DE's `ExportWeapons.name` and
 * the wiki's `Module:Weapons/data/<subpage>` top-level key. The misses
 * fall into a handful of patterns:
 *   - Capitalization: DE "MK1-Braton" vs wiki "Mk1-Braton"
 *   - Disambiguation parens: DE "Dark Split-Sword" vs wiki "Dark Split-Sword (Dual Swords)"
 *   - Multi-mode weapons (Vinquibus, Dark Split-Sword) — wiki splits them
 *     into one entry per mode; we map DE's single name to a canonical one
 *
 * Add an entry here when `merge-weapons.ts` reports a DE name as
 * unmatched; the build's `_report.json` lists current unmatched names.
 */

/** DE weapon name → wiki module key. */
export const WIKI_ALIASES: Record<string, string> = {
  // ── MK1 starter weapons (case mismatch — DE uppercases, wiki capitalizes) ──
  "MK1-Braton": "Mk1-Braton",
  "MK1-Paris": "Mk1-Paris",
  "MK1-Strun": "Mk1-Strun",
  "MK1-Kunai": "Mk1-Kunai",
  "MK1-Furis": "Mk1-Furis",
  "MK1-Bo": "Mk1-Bo",
  "MK1-Furax": "Mk1-Furax",

  // ── Multi-mode weapons (wiki splits to one entry per mode; we pick one) ──
  // Dark Split-Sword is one DE entry but two wiki entries (Dual Swords +
  // Heavy Blade modes). Map to the Dual Swords variant — that's the
  // default in-game mode and has stance compatibility we care about.
  "Dark Split-Sword": "Dark Split-Sword (Dual Swords)",
  // Vinquibus splits into primary + melee modes on the wiki. DE only has
  // one entry; map to the primary mode (the rifle form).
  Vinquibus: "Vinquibus (Primary)",
}
