/** Shared DE-name helpers for the build mergers. */

/** DE prefixes some archwing weapons/frames with `<ARCHWING> ` in their
 *  `name` field. The wiki keys them without the prefix, so we strip it for
 *  both wiki lookup and the canonical emitted name. */
export const ARCHWING_PREFIX = "<ARCHWING> "

/** Variant family for items the wiki gives no `Family` (companions, archwing
 *  frames): the name minus a trailing " Prime", so "Shade Prime" groups with
 *  "Shade" and companion augments/precepts fan out to the Prime (#398). */
export function primeFamily(name: string): string {
  return name.replace(/ Prime$/, "")
}

export function cleanDeName(name: string): string {
  return name.startsWith(ARCHWING_PREFIX)
    ? name.slice(ARCHWING_PREFIX.length)
    : name
}
