import type { Arcane } from "@arsenyx/shared/warframe/types"
import { useMemo } from "react"

import type { BrowseCategory, DetailItem } from "@/lib/warframe"

import {
  calculateCapacity,
  calculateFormaCount,
  calculateTotalEndoCost,
} from "./calculations"
import {
  type ArcaneSlotConfig,
  getArcaneSlotConfig,
  getArcaneSlotCount,
  getAuraSlotCount,
  getMaxLevelCap,
  getNormalSlotCount,
  getPlexusGroupForIndex,
  hasExilusSlot,
  hasStanceSlot,
} from "./layout"
import {
  getAuraPolarities,
  getExilusInnatePolarity,
  getStanceInnatePolarity,
  toPolarity,
} from "./mod-grid"
import type { BuildSlotsState } from "./use-build-slots"

/**
 * Pure per-(item, category) slot layout — used as inputs to `useBuildSlots`
 * and `useBuildDerived`. Both the editor and the read-only viewer compute
 * the same handful of values from the same `(item, category)` pair, so the
 * derivation lives in one place.
 */
export interface BuildLayout {
  isCompanion: boolean
  normalSlotCount: number
  auraSlotCount: number
  arcaneCount: number
  showExilus: boolean
  showStance: boolean
}

export function getBuildLayout(
  item: DetailItem,
  category: BrowseCategory,
): BuildLayout {
  return {
    isCompanion: category === "companions",
    normalSlotCount: getNormalSlotCount(category),
    auraSlotCount: getAuraSlotCount(category, item),
    arcaneCount: getArcaneSlotCount(category, item.type),
    showExilus: hasExilusSlot(category),
    showStance: hasStanceSlot(item, category),
  }
}

/**
 * Derived view state: arcane picker config, endo/forma totals, capacity.
 * Inputs are read-only; the same computation drives editor and viewer.
 *
 * Innate polarities and the railjack `normalSlotConsumesDrain` mask are
 * computed internally to feed `capacity` / `formaCount` but not surfaced —
 * no caller has needed them yet. Pull them up if that changes.
 */
export interface BuildDerived {
  arcaneConfig: ArcaneSlotConfig
  totalEndoCost: number
  formaCount: number
  capacity: { used: number; max: number; base: number; auraBonus: number }
}

export function useBuildDerived(input: {
  item: DetailItem
  category: BrowseCategory
  layout: BuildLayout
  slots: BuildSlotsState
  allArcanes: Arcane[]
  hasReactor: boolean
}): BuildDerived {
  const { item, category, layout, slots, allArcanes, hasReactor } = input
  const { normalSlotCount, auraSlotCount, arcaneCount } = layout

  const arcaneConfig = useMemo(
    () => getArcaneSlotConfig(allArcanes, category, arcaneCount, item),
    [allArcanes, category, arcaneCount, item],
  )

  const auraInnates = useMemo(
    () => getAuraPolarities(item, auraSlotCount),
    [item, auraSlotCount],
  )
  const exilusInnate = useMemo(() => getExilusInnatePolarity(item), [item])
  const stanceInnate = useMemo(() => getStanceInnatePolarity(item), [item])
  const normalInnates = useMemo(
    () =>
      Array.from({ length: normalSlotCount }, (_, i) =>
        toPolarity(item.polarities?.[i]),
      ),
    [item.polarities, normalSlotCount],
  )

  const totalEndoCost = useMemo(
    () => calculateTotalEndoCost(slots.placed),
    [slots.placed],
  )
  const formaCount = useMemo(
    () =>
      calculateFormaCount({
        auraInnates,
        exilusInnate,
        stanceInnate,
        normalInnates,
        formaPolarities: slots.formaPolarities,
      }),
    [
      auraInnates,
      exilusInnate,
      stanceInnate,
      normalInnates,
      slots.formaPolarities,
    ],
  )

  const normalSlotConsumesDrain = useMemo(() => {
    if (category !== "railjack") return undefined
    return Array.from({ length: normalSlotCount }, (_, i) => {
      const group = getPlexusGroupForIndex(category, i)
      return group === "integrated"
    })
  }, [category, normalSlotCount])

  const capacity = useMemo(
    () =>
      calculateCapacity({
        placed: slots.placed,
        formaPolarities: slots.formaPolarities,
        auraInnates,
        exilusInnate,
        stanceInnate,
        normalInnates,
        hasReactor,
        maxLevelCap: getMaxLevelCap(category, item),
        normalSlotConsumesDrain,
      }),
    [
      slots.placed,
      slots.formaPolarities,
      auraInnates,
      exilusInnate,
      stanceInnate,
      normalInnates,
      hasReactor,
      category,
      item,
      normalSlotConsumesDrain,
    ],
  )

  return {
    arcaneConfig,
    totalEndoCost,
    formaCount,
    capacity,
  }
}
