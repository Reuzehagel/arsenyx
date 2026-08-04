/**
 * Shared polarity normalization for the frame / companion / weapon mergers.
 * Single source of truth so the known-polarity set can't drift between them.
 */

/** Canonical Warframe polarity names (lowercase long-form). The UI codec
 *  abbreviates these downstream; the build keeps the long form. */
export const POLARITY_SET = new Set<string>([
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
  "exilus",
  "universal",
  "any",
])

/** Wiki spellings that mean the Universal ("Any"/Omni) polarity — the
 *  `Any_Pol` glyph. `Module:Warframes/data` and `Module:Weapons/data` write it
 *  as "Aura" (the Aura Forma's name) regardless of which slot it sits in:
 *  Dante's and Protea's aura slots, Vinquibus's normal + stance slots. Our
 *  canonical name for it is "any"; "universal" downstream means "no polarity",
 *  so mapping this to "universal" would silently drop the slot's bonus. */
const POLARITY_ALIASES: Record<string, string> = {
  aura: "any",
}

/** Normalize a wiki polarity string to lowercase. The wiki's "None" sentinel
 *  becomes null. An unrecognized value warns (for audit) but passes through
 *  verbatim so the merge never throws on new/odd data. */
export function normalizePolarity(p: unknown): string | null {
  if (typeof p !== "string" || p.length === 0) return null
  const lower = p.toLowerCase()
  if (lower === "none") return null
  const aliased = POLARITY_ALIASES[lower] ?? lower
  if (!POLARITY_SET.has(aliased)) {
    console.warn(`normalizePolarity: unknown polarity ${JSON.stringify(p)}`)
  }
  return aliased
}

/** Normalize a list of wiki polarity values, dropping `None`/empty entries
 *  (unknown values pass through verbatim with a warning). The frame / weapon /
 *  companion mergers all share this shape. */
export function normalizePolarities(list: readonly unknown[]): string[] {
  return list.map(normalizePolarity).filter((p): p is string => p !== null)
}
