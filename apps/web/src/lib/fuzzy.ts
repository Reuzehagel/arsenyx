import uFuzzy from "@leeoniya/ufuzzy"

// Shared fuzzy matcher for search surfaces (command palette, mod grid). A single
// instance is fine — uFuzzy holds no per-search state. intraMode 1 (single-error)
// tolerates one typo per term, so "seration" still finds Serration.
// IntraMode is an ambient const enum, which isolatedModules can't reference.
// oxlint-disable-next-line typescript/no-unsafe-enum-assignment
const uf = new uFuzzy({ intraMode: 1 })

/**
 * Rank `haystack` against `needle`, returning haystack indices best-match-first.
 * Returns an empty array when the needle is blank or nothing matches.
 *
 * Best suited to short, discrete labels (item/mod names). Running it against
 * long concatenated text over-matches — for those, match the name here and keep
 * a substring check for the rest.
 */
export function fuzzyRank(haystack: string[], needle: string): number[] {
  const q = needle.trim()
  if (!q) return []
  const idxs = uf.filter(haystack, q)
  if (!idxs || idxs.length === 0) return []
  const info = uf.info(idxs, haystack, q)
  const order = uf.sort(info, haystack, q)
  return order.map((o) => info.idx[o])
}
