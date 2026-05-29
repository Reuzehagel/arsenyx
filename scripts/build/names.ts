/** Shared DE-name helpers for the build mergers. */

/** DE prefixes some archwing weapons/frames with `<ARCHWING> ` in their
 *  `name` field. The wiki keys them without the prefix, so we strip it for
 *  both wiki lookup and the canonical emitted name. */
export const ARCHWING_PREFIX = "<ARCHWING> "

export function cleanDeName(name: string): string {
  return name.startsWith(ARCHWING_PREFIX)
    ? name.slice(ARCHWING_PREFIX.length)
    : name
}
