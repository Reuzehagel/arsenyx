/**
 * DE upgrade records the build drops by identity. Pattern-based drops (Riven,
 * /Beginner/, unreleased Primed Expert, …) stay in merge-mods.ts `shouldKeep`.
 */

/** Display names of non-buildable placeholders. "Unfused Artifact" is the
 *  Railjack crew-ship innate-damage shell (no stats) in ExportUpgrades, and
 *  DE's pre-fusion avionic shell (one per `/Railjack/<section>/Base*`) in
 *  ExportAvionics; the real avionics are the Lavan / Vidar / Zekti variants. */
export const DROPPED_MOD_NAMES: ReadonlySet<string> = new Set([
  "Unfused Artifact",
])

/** uniqueNames of stray upstream entries that aren't real in-game mods. */
export const DROPPED_MOD_UNIQUE_NAMES: ReadonlySet<string> = new Set([
  // A duplicate "Pressure Point" with a combo-count bonus.
  "/Lotus/Upgrades/Mods/Melee/WeaponMeleeDamageOnHeavyKillMod",
])
