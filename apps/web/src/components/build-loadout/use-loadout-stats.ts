import type {
  PlacedArcane,
  PlacedMod,
  SlotId,
} from "@arsenyx/shared/warframe/build-data"
import type {
  Warframe,
  BrowseCategory,
  PlacedShard,
} from "@arsenyx/shared/warframe/types"
import { useMemo } from "react"

import { placedModsInSlotOrder } from "@/lib/build/slot-order"
import type { DetailItem } from "@/lib/catalog"
import { calculateWarframeStats, type WarframeStats } from "@/lib/stats"

export function itemHasWeaponData(item: DetailItem): boolean {
  if (item.totalDamage !== undefined) return true
  const attacks = (item as { attacks?: unknown[] }).attacks
  return Array.isArray(attacks) && attacks.length > 0
}

/** Archwing suits (health) share the `archwing` category with arch-guns and
 *  arch-melee (attack data). */
function isArchwingSuit(item: DetailItem, category: BrowseCategory) {
  return (
    category === "archwing" &&
    !itemHasWeaponData(item) &&
    item.health !== undefined
  )
}

/**
 * The loadout's mods (slot reading order — elemental combination depends on
 * it), its arcanes, and warframe-body stats when the item has a frame body.
 * Shared by the sidebar and the embed's ability strip so both read one
 * computation.
 */
export function useLoadoutStats(input: {
  item: DetailItem
  category: BrowseCategory
  placedMods: Partial<Record<SlotId, PlacedMod>>
  placedArcanes: (PlacedArcane | null)[]
  shards: (PlacedShard | null)[]
  showMaxStacks?: boolean
}) {
  const { item, category, placedMods, placedArcanes, shards } = input
  const showMaxStacks = input.showMaxStacks ?? false
  const mods = useMemo(() => placedModsInSlotOrder(placedMods), [placedMods])
  const arcanes = useMemo(
    () => placedArcanes.filter((a): a is PlacedArcane => !!a),
    [placedArcanes],
  )
  const archwingSuit = isArchwingSuit(item, category)
  const isWarframe =
    category === "warframes" || category === "necramechs" || archwingSuit
  const skipRankUpBonus = category === "necramechs" || archwingSuit
  const warframeStats = useMemo<WarframeStats | null>(
    () =>
      isWarframe
        ? calculateWarframeStats({
            warframe: item as unknown as Warframe,
            mods,
            arcanes,
            shards,
            skipRankUpBonus,
            showMaxStacks,
          })
        : null,
    [isWarframe, item, mods, arcanes, shards, skipRankUpBonus, showMaxStacks],
  )
  return { mods, arcanes, isWarframe, warframeStats }
}
