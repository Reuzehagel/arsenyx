/**
 * Per-name modPool overrides.
 *
 * Default rule for the build (in scripts/build/merge-weapons.ts):
 *   modPools = CLASS_DEFAULT_POOLS[wikiClass]  ∪  [weapon.name]  ∪  family extras
 *
 * This file is the small per-name override layer applied on top of that
 * default. Use it when class-level inference would route the weapon to the
 * wrong pool — overwhelmingly that's the Arm-Cannon family (Shedu pulls
 * from Rifle, Bubonico from Shotgun, Sepulcrum from Pistol; nothing about
 * Class or CompatibilityTags can tell them apart structurally).
 *
 * Each override REPLACES the class-default pool list. The weapon's own name
 * is still appended for augment compatibility.
 *
 * Verified: this list should stay under ~20 entries. If it grows, the
 * class-level default rule probably needs tightening.
 */

/** Override pool list for specific weapon names. */
export const MOD_POOL_OVERRIDES: Record<string, readonly string[]> = {
  // Arm-Cannon family — wiki Class doesn't disambiguate which mod pool
  // each draws from. Verified 2026-05-27 against the wiki.
  Shedu: ["Rifle"],
  Bubonico: ["Shotgun"],
  "Coda Bubonico": ["Shotgun"],
  Sepulcrum: ["Pistol"],
  // Cyte-09's Arm-Cannon (Aerolyst) — TBD, leave to default for now.
}
