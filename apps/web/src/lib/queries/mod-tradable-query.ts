import { staticDataQuery } from "./static-data-query"

/**
 * uniqueNames of mods that are NOT tradable on Warframe Market (~38 of ~1400 —
 * Umbral / Sacrificial / Amalgam / a few Primed). Sparse by design: absent =
 * tradable. The build viewer loads this to gate the Market link on the mod
 * detail popover without pulling the ~1.35 MB mods-all.json. DE ships no
 * tradability for mods, so the source is wiki `Mods_data.Tradable`.
 */
export const modTradableQuery = staticDataQuery<string[]>(
  ["mod-tradable"],
  "/data/mod-tradable.json",
  "failed to load mod tradability",
)
