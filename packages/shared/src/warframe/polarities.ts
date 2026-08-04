import type { Polarity } from "./types"

/** The 7 canonical in-game polarities (no "any"/"universal"). */
export const CANONICAL_POLARITIES: readonly Polarity[] = [
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
] as const

/** Polarities an item can carry innately: the 7 canonical, plus "any" — the
 *  Universal polarity some items ship with (Dante's / Protea's aura slot,
 *  Vinquibus's normal + stance slots). "universal" is deliberately excluded:
 *  it's the "explicitly cleared" sentinel, never an innate value. */
const ACCEPTED_SET = new Set<Polarity>([...CANONICAL_POLARITIES, "any"])

/** Narrow an arbitrary string to a Polarity, or undefined. Used to sanitize
 *  stored/wire polarity values (item innates, saved forma choices) before they
 *  feed slot/forma/capacity math. */
export function toPolarity(v: string | null | undefined): Polarity | undefined {
  if (!v) return undefined
  return ACCEPTED_SET.has(v as Polarity) ? (v as Polarity) : undefined
}
