/**
 * Atmospheric Archgun damage overrides.
 *
 * Archguns deployed on the ground via Archgun Deployer lose their innate
 * elemental damage. DE only models the Archwing-mission profile, so we
 * curate the divergent atmospheric-mode damage profile here. Moved from
 * scripts/build-items-index.ts in Phase 4.
 *
 * `strip` is the list of damage-type keys whose innate value goes to zero
 * in atmospheric mode. The merge step applies the strip to the base damage
 * table and emits the result as `atmosphericDamage`/`atmosphericTotalDamage`
 * on the item.
 */

export type AtmosphericOverride = {
  /** Damage-type keys to zero out (lowercase: "heat", "cold", etc.) */
  strip: readonly string[]
}

/** Weapon name → atmospheric override. */
export const ATMOSPHERIC_OVERRIDES: Record<string, AtmosphericOverride> = {
  Corvas: { strip: ["heat"] },
  "Corvas Prime": { strip: ["heat"] },
}
