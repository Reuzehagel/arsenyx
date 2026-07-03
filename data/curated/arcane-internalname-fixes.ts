/**
 * Wiki `InternalName` corrections for arcanes.
 *
 * The build joins DE arcanes to their wiki full-art by `InternalName`
 * (the DE uniqueName) — see resolve-images.ts. `Module:Arcane/data` is
 * community-edited, and a row's `InternalName` is occasionally mislabeled
 * with a *neighbour's* uniqueName (a shifted column). When that happens the
 * art lands on the wrong arcane: the mislabeled one inherits a sibling's
 * icon, and its own arcane gets none (falling back to DE's frameless
 * projection symbol).
 *
 * This map corrects the join key at ingestion, keyed by the wiki row's stable
 * `Name` field → the *correct* DE uniqueName (verified against
 * ExportRelicArcane). It's a gap-stop for upstream data errors, same spirit as
 * WIKI_ALIASES. Add an entry when a row is mislabeled; remove it once the wiki
 * row carries the right `InternalName` again (the wiki stays authoritative when
 * its data is correct). The map is empty when the wiki is accurate.
 *
 * History — Crepuscular/Sculptor (#266, observed in the 2026-06-28 #262
 * refresh): their rows carried each other's / Steadfast's id, so Crepuscular
 * went frameless, Sculptor showed Crepuscular's art, and Steadfast showed
 * Sculptor's. Corrected upstream on 2026-06-30 (all three rows verified against
 * `Module:Arcane/data`), so the entries were removed.
 */

/** Wiki `Name` → correct DE uniqueName. Empty when the wiki is accurate. */
export const ARCANE_INTERNALNAME_FIXES: Record<string, string> = {}
