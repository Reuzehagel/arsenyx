/**
 * Curated "always-keep" arcanes — a resilience guard for the arcane build.
 *
 * Arcanes are filtered down to the wiki's canonical in-game set
 * (`wikiArcaneNames`, built from `Module:Arcanes/data`) to drop DE's
 * per-ability-slot dupes and cut content (see `build-items-index.ts`). That
 * makes a real arcane disappear from our catalog whenever the wiki module is
 * momentarily inconsistent — e.g. a freshly-added row whose `Image` lags, which
 * dropped Arcane Crepuscular and mis-iconed its neighbours after the
 * 2026-06-21 wiki Lua sync. Listing a uniqueName here keeps it even when the
 * wiki module omits it; its image then falls back to DE's projection symbol
 * until the wiki row is repaired.
 *
 * Keep this list SMALL and high-confidence — only verified, currently-obtainable
 * arcanes the wiki has wrongly dropped. Remove an entry once the wiki module
 * lists it again (the wiki stays authoritative when it has the data).
 */

export const ARCANE_KEEP: ReadonlySet<string> = new Set<string>([
  // Arcane Crepuscular (Update 38.0) — "While invisible, +30% Ability Strength
  // and +3x Final Critical Damage." Verified live on wiki.warframe.com; the
  // Lua module dropped its Image after the 2026-06-21 refresh.
  "/Lotus/Upgrades/CosmeticEnhancers/Utility/AbilityStrengthAndCritDamageWhenInvisible",
])
