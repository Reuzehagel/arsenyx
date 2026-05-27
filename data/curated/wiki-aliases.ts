/**
 * DE-name → Wiki-key alias map. Populated as merge discovers misses.
 *
 * Most weapons match by exact name between DE's `ExportWeapons.name` and the
 * wiki's `Module:Weapons/data/<subpage>` top-level key. The misses I expect:
 * - Punctuation differences (`"AX-52"` vs `"Ax-52"`)
 * - Capitalization (`"Hek"` vs `"HEK"`)
 * - Spaces (`"Heliocor"` vs `"Heliocor "` trailing space on wiki edits)
 *
 * Empty for now — the merge step logs unmatched DE entries; those become
 * candidates for this table.
 */

/** DE weapon name → wiki module key. */
export const WIKI_ALIASES: Record<string, string> = {
  // (populate as needed; merge-weapons.ts warns when it can't find a match)
}
