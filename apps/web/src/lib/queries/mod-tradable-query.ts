import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { useQuery } from "@tanstack/react-query"

import { marketUrl } from "@/lib/util/warframe-links"

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

/**
 * Warframe Market URL for a mod, or undefined while the tradability index
 * hasn't loaded / the mod isn't tradable. Rivens carry a stub uniqueName with
 * no Market page, so they never link. Pass `enabled: false` until a detail
 * surface actually opens — the index is only fetched on demand.
 */
export function useModMarketHref(
  mod: Mod | undefined,
  enabled: boolean,
): string | undefined {
  const { data: nonTradable } = useQuery({
    ...modTradableQuery,
    enabled: enabled && !!mod,
  })
  return mod &&
    nonTradable &&
    !isRivenMod(mod) &&
    !nonTradable.includes(mod.uniqueName)
    ? marketUrl(mod.name)
    : undefined
}
