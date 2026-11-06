/** Shared name helpers for the build mergers. */

/** DE prefixes some archwing weapons/frames with `<ARCHWING> ` in their
 *  `name` field. The wiki keys them without the prefix, so we strip it for
 *  both wiki lookup and the canonical emitted name. */
const ARCHWING_PREFIX = "<ARCHWING> "

export function cleanDeName(name: string): string {
  return name.startsWith(ARCHWING_PREFIX)
    ? name.slice(ARCHWING_PREFIX.length)
    : name
}

/** Item names carrying " Prime" (anywhere — "Garuda Prime Talons"). */
export function isPrime(name: string): boolean {
  return name.includes(" Prime")
}

/** Variant family for items the wiki gives no `Family` (companions, archwing
 *  frames): the name minus a trailing " Prime", so "Shade Prime" groups with
 *  "Shade" and companion augments/precepts fan out to the Prime (#398). */
export function primeFamily(name: string): string {
  return name.replace(/ Prime$/, "")
}

/** Mod name prefixes of a Primed/Umbral variant (`isPrime` mods). */
export const PRIMED_MOD_PREFIXES = ["Primed ", "Umbral "] as const

/** Every prefix naming a variant of a same-named base mod (Primed Reach ↔
 *  Reach). Cross-stem families (Galvanized, Sacrificial) don't share a stem. */
const MOD_VARIANT_PREFIXES = [
  ...PRIMED_MOD_PREFIXES,
  "Amalgam ",
  "Archon ",
] as const

/** The base mod name a variant name derives from ("Primed Reach" → "Reach"),
 *  or undefined when `name` has none of `prefixes`. */
export function modVariantBase(
  name: string,
  prefixes: readonly string[] = MOD_VARIANT_PREFIXES,
): string | undefined {
  const prefix = prefixes.find((p) => name.startsWith(p))
  return prefix && name.slice(prefix.length)
}

/** Wiki Slot of an arch-gun's atmospheric (ground-deployed) entry, which the
 *  build folds into the base weapon's `atmospheric*` fields. */
export const ATMOSPHERE_SLOT = "Archgun (Atmosphere)"

/** Wiki key of a weapon's atmospheric entry: "Mausolon (Atmosphere)". */
export function atmosphereVariantName(name: string): string {
  return `${name} (Atmosphere)`
}
