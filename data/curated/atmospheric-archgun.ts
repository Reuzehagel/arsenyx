/**
 * Atmospheric Archgun damage overrides.
 *
 * Archguns deployed on the ground via Archgun Deployer lose their innate
 * elemental damage. DE only models the Archwing-mission profile, so we
 * curate the divergent atmospheric-mode damage profile here.
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
  // Corvas Prime is NOT included: its atmospheric profile is identical to
  // its Archwing profile (it keeps its Heat damage), unlike base Corvas.
  Corvas: { strip: ["heat"] },
}
