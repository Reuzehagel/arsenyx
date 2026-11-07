/** The 7 canonical in-game polarities, keyed by DE's `AP_*` export code. */
const CANONICAL = {
  madurai: "AP_ATTACK",
  vazarin: "AP_DEFENSE",
  naramon: "AP_TACTIC",
  zenurik: "AP_POWER",
  unairu: "AP_WARD",
  penjaga: "AP_PRECEPT",
  umbra: "AP_UMBRA",
} as const

/** Every polarity value, with DE's export code. Beyond the canonical 7:
 *  - "any": the Universal (Aura/Omni) forma that matches every mod. Some items
 *    ship with it innately (Dante's / Protea's aura slot, Vinquibus's normal +
 *    stance slots).
 *  - "universal": the "no polarity / explicitly cleared" sentinel — never an
 *    innate value. */
const POLARITY_TABLE = {
  ...CANONICAL,
  any: "AP_ANY",
  universal: "AP_UNIVERSAL",
} as const

export type Polarity = keyof typeof POLARITY_TABLE

export const CANONICAL_POLARITIES = Object.keys(CANONICAL) as Array<
  keyof typeof CANONICAL
>

export const POLARITIES = Object.keys(POLARITY_TABLE) as Polarity[]

/** DE's `AP_*` polarity code → our polarity. */
export const DE_POLARITY_MAP: Readonly<Record<string, Polarity>> =
  Object.fromEntries(
    Object.entries(POLARITY_TABLE).map(([p, de]) => [de, p as Polarity]),
  )

const INNATE_SET = new Set<string>([...CANONICAL_POLARITIES, "any"])

/** Narrow an arbitrary string to a polarity an item can carry innately (the
 *  canonical 7 plus "any"), or undefined. Sanitizes stored/wire polarity
 *  values (item innates, saved forma choices) before they feed slot/forma/
 *  capacity math. */
export function toPolarity(v: string | null | undefined): Polarity | undefined {
  if (!v) return undefined
  return INNATE_SET.has(v) ? (v as Polarity) : undefined
}

/** Legacy single-letter / glyph spellings seen in old share links. */
const POLARITY_ALIASES: Record<string, Polarity> = {
  d: "vazarin",
  r: "madurai",
  dash: "naramon",
  v: "madurai",
}

/** Lenient parse of a wire polarity (share links): case-insensitive, accepts
 *  the legacy aliases, and falls back to "universal" for anything unknown. */
export function normalizePolarity(polarity?: string): Polarity {
  if (!polarity || typeof polarity !== "string") return "universal"
  const lower = polarity.toLowerCase()
  if (Object.hasOwn(POLARITY_TABLE, lower)) return lower as Polarity
  return POLARITY_ALIASES[lower] ?? "universal"
}
