// Stats calculation module — entry point and re-exports

import type { CalculatedStats } from "../stat-types"
import type { BrowseableItem, BuildState, Warframe, Companion, Gun, Melee } from "../types"
import { calculateWarframeStats } from "./warframe-stats"
import { calculateWeaponStats } from "./weapon-stats"

export { calculateWarframeStats } from "./warframe-stats"
export { calculateWeaponStats } from "./weapon-stats"
export { buildHasConditionalMods } from "./stat-engine"

/**
 * Check if an archwing-category item is a frame (vs a weapon)
 * WFCD category "Archwing" = the vehicle, "Arch-Gun"/"Arch-Melee" = weapons
 */
function isArchwingFrame(item: BrowseableItem): boolean {
  return item.category === "Archwing"
}

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

  // Archwing category includes Archwing frames + Arch-Gun/Arch-Melee weapons
  if (category === "archwing") {
    if (isArchwingFrame(item)) {
      // Archwing frames have warframe-like stats (health, shield, armor, energy)
      // WFCD data already includes rank-30 values, so skip rank-up bonuses
      return {
        warframe: calculateWarframeStats(
          item as Warframe,
          buildState,
          showMaxStacks,
          { skipRankUpBonus: true },
        ),
      }
    }
    // Arch-Gun and Arch-Melee have weapon-like stats
    return {
      weapon: calculateWeaponStats(
        item as Gun | Melee,
        buildState,
        showMaxStacks,
      ),
    }
  }

  // Companions (Kubrows, Kavats, Sentinels) have warframe-like survivability stats
  if (category === "companions") {
    return {
      warframe: calculateWarframeStats(
        item as Companion as Warframe,
        buildState,
        showMaxStacks,
        { skipRankUpBonus: true },
      ),
    }
  }

  // Exalted weapons and companion weapons have weapon-like stats
  if (category === "exalted-weapons" || category === "companion-weapons") {
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
