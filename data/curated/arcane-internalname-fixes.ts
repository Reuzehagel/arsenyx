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
 * WIKI_ALIASES. Remove an entry once the wiki row carries the right
 * `InternalName` again (the wiki stays authoritative when its data is correct).
 *
 * Observed 2026-06-28 (#262 refresh): Crepuscular/Sculptor rows carried each
 * other's / Steadfast's id, so Crepuscular went frameless, Sculptor showed
 * Crepuscular's art, and Steadfast showed Sculptor's. Steadfast's own row is
 * correct; fixing the two below resolves the whole chain.
 */

/** Wiki `Name` → correct DE uniqueName. */
export const ARCANE_INTERNALNAME_FIXES: Record<string, string> = {
  "Arcane Crepuscular":
    "/Lotus/Upgrades/CosmeticEnhancers/Utility/AbilityStrengthAndCritDamageWhenInvisible",
  "Arcane Sculptor":
    "/Lotus/Upgrades/CosmeticEnhancers/Utility/AbilityEfficiencyOnAbilityObjectCreation",
}
