import { slugify } from "@arsenyx/shared/warframe/slugs"

import { EXTERNAL_LINKS } from "./constants"

/**
 * External "how to get it" links for mods and arcanes. We don't ship drop /
 * acquisition data in the static catalog (mods-all.json / arcanes-all.json
 * carry no `drops`), so the wiki page — which lists every acquisition source —
 * is the authoritative reference, with Warframe Market for trade pricing.
 *
 * URL schemes verified against live pages (2026-06):
 *   wiki:   https://wiki.warframe.com/w/<PageName>   spaces → "_", rest URL-encoded
 *   market: https://warframe.market/items/<url_name> lowercase; spaces & "-" → "_";
 *           "&" → "and"; apostrophes dropped
 * Examples: "Calm & Frenzy" → calm_and_frenzy, "Butcher's Revelry" →
 * butchers_revelry, "Spring-Loaded Blade" → spring_loaded_blade.
 */

const WIKI_BASE = `${EXTERNAL_LINKS.wiki}/w`
const MARKET_BASE = "https://warframe.market/items"

/** Wiki article URL for a mod/arcane/item by its display name. */
export function wikiUrl(name: string): string {
  return `${WIKI_BASE}/${encodeURIComponent(name.replace(/ /g, "_"))}`
}

/**
 * Warframe Market `url_name` slug for a tradable item's display name. Market
 * uses the same normalization as our internal `slugify` (lowercase, drop
 * apostrophes, "&" → "and", collapse separators) but joins with "_" instead
 * of "-".
 */
export function marketSlug(name: string): string {
  return slugify(name).replace(/-/g, "_")
}

/** Warframe Market listing URL for a tradable item by its display name. */
export function marketUrl(name: string): string {
  return `${MARKET_BASE}/${marketSlug(name)}`
}
