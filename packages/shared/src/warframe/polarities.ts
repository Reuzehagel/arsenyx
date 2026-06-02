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

const CANONICAL_SET = new Set<Polarity>(CANONICAL_POLARITIES)

/** Narrow an arbitrary string to a canonical Polarity, or undefined. Used to
 *  sanitize stored/wire polarity values (item innates, saved forma choices)
 *  before they feed slot/forma/capacity math. */
export function toPolarity(v: string | null | undefined): Polarity | undefined {
  if (!v) return undefined
  return CANONICAL_SET.has(v as Polarity) ? (v as Polarity) : undefined
}
