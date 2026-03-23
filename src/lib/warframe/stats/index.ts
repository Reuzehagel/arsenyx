// Stats calculation module — entry point and re-exports

import type { CalculatedStats } from "../stat-types"
import type { BrowseableItem, BuildState, Warframe, Gun, Melee } from "../types"
import { calculateWarframeStats } from "./warframe-stats"
import { calculateWeaponStats } from "./weapon-stats"

export { calculateWarframeStats } from "./warframe-stats"
export { calculateWeaponStats } from "./weapon-stats"
export { buildHasConditionalMods } from "./stat-engine"

/**
 * Main entry point - calculate all stats for a build
 */
export function calculateStats(
  item: BrowseableItem,
  buildState: BuildState,
  showMaxStacks = false,
): CalculatedStats {
  const category = buildState.itemCategory

  if (category === "warframes" || category === "necramechs") {
    return {
      warframe: calculateWarframeStats(
        item as Warframe,
        buildState,
        showMaxStacks,
      ),
    }
  }

  if (
    category === "primary" ||
    category === "secondary" ||
    category === "melee"
  ) {
    return {
      weapon: calculateWeaponStats(
        item as Gun | Melee,
        buildState,
        showMaxStacks,
      ),
    }
  }

  return {}
}
