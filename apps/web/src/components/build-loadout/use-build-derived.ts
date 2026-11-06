import type { PlacedMod, SlotId } from "@arsenyx/shared/warframe/build-data"
import type {
  Arcane,
  Polarity,
  BrowseCategory,
} from "@arsenyx/shared/warframe/types"
import { useMemo } from "react"

import {
  calculateCapacity,
  calculateTotalEndoCost,
  type CapacityInput,
} from "@/lib/build/calculations"
import { computeFormaCount } from "@/lib/build/forma-count"
import {
  type ArcaneSlotConfig,
  type BuildLayout,
  getArcaneSlotConfig,
  getLockedStance,
  getMaxLevelCap,
} from "@/lib/build/layout"
import { plexusGroupForIndex } from "@/lib/build/plexus"
import { getInnatePolarities } from "@/lib/build/polarities"
import type { DetailItem } from "@/lib/catalog"

export interface BuildDerived {
  arcaneConfig: ArcaneSlotConfig
  totalEndoCost: number
  formaCount: number
  capacity: { used: number; max: number; base: number; auraBonus: number }
  /** Capacity inputs that don't vary per variant, for the multi-variant
   *  auto-forma planner (which swaps `placed` per variant). */
  capacitySharedInputs: Omit<CapacityInput, "placed" | "formaPolarities">
}

/** Arcane picker config, endo/forma totals and capacity — the same derivation
 *  for the editor and the viewer. `item` is the form-overlaid item. */
export function useBuildDerived(input: {
  item: DetailItem
  category: BrowseCategory
  layout: BuildLayout
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  allArcanes: Arcane[]
  hasReactor: boolean
}): BuildDerived {
  const { item, category, layout, placed, formaPolarities, allArcanes } = input
  const { normalSlotCount } = layout

  const arcaneConfig = useMemo(
    () => getArcaneSlotConfig(allArcanes, category, item),
    [allArcanes, category, item],
  )

  const innates = useMemo(
    () => getInnatePolarities(item, category),
    [item, category],
  )

  const totalEndoCost = useMemo(() => calculateTotalEndoCost(placed), [placed])
  const formaCount = useMemo(
    () => computeFormaCount(item, category, formaPolarities),
    [item, category, formaPolarities],
  )

  const capacitySharedInputs = useMemo<
    Omit<CapacityInput, "placed" | "formaPolarities">
  >(
    () => ({
      innates,
      hasReactor: input.hasReactor,
      maxLevelCap: getMaxLevelCap(category, item),
      lockedStance: getLockedStance(item, category),
      normalSlotConsumesDrain:
        category === "railjack"
          ? Array.from(
              { length: normalSlotCount },
              (_, i) => plexusGroupForIndex(i)?.consumesDrain ?? false,
            )
          : undefined,
    }),
    [innates, input.hasReactor, category, item, normalSlotCount],
  )
  const capacity = useMemo(
    () =>
      calculateCapacity({ ...capacitySharedInputs, placed, formaPolarities }),
    [capacitySharedInputs, placed, formaPolarities],
  )

  return {
    arcaneConfig,
    totalEndoCost,
    formaCount,
    capacity,
    capacitySharedInputs,
  }
}
