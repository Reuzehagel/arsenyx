import { toPolarity } from "@arsenyx/shared/warframe/polarities"
import type { Polarity } from "@arsenyx/shared/warframe/types"

import type { BrowseCategory, DetailItem } from "@/lib/warframe"

import { calculateFormaCount } from "./calculations"
import { getAuraSlotCount, getNormalSlotCount } from "./layout"
import type { SlotId } from "./use-build-slots"

// Pure (React-free) forma derivation. Kept out of mod-grid.tsx / build-derived.ts
// so it can be reused both by the editor and by the offline recompute backfill
// (scripts/recompute-forma.ts), which can't load React. mod-grid.tsx re-exports
// the polarity helpers for existing importers.

export { toPolarity }

/**
 * Per-slot innate polarities for an item's aura slots. `item.auraPolarity`
 * may be a single polarity string (most frames) or an array (Jade: 2 slots).
 * Length always matches `count` so callers can zip by index.
 */
export function getAuraPolarities(
  item: Pick<DetailItem, "auraPolarity">,
  count: number,
): (Polarity | undefined)[] {
  const raws = Array.isArray(item.auraPolarity)
    ? item.auraPolarity
    : item.auraPolarity
      ? [item.auraPolarity]
      : []
  return Array.from({ length: count }, (_, i) => toPolarity(raws[i]))
}

/**
 * Innate exilus polarity, sourced from the `exilusPolarity` field
 * (extracted from the Warframe wiki's `Module:Weapons/data` /
 * `Module:Warframes/data` Lua tables).
 */
export function getExilusInnatePolarity(
  item: Pick<DetailItem, "exilusPolarity">,
): Polarity | undefined {
  return toPolarity(item.exilusPolarity)
}

export function getStanceInnatePolarity(
  item: Pick<DetailItem, "stancePolarity">,
): Polarity | undefined {
  return toPolarity(item.stancePolarity)
}

/**
 * Forma count for a build: a pure function of the item's innate polarities
 * (game catalog) + the user's per-slot forma polarities (`formaPolarities`,
 * stored in buildData). This is the single source of truth the editor
 * (`useBuildDerived`) and the recompute backfill both call, so a card's count
 * always matches the detail page and a future fix only has to change here.
 */
export function computeFormaCount(
  item: DetailItem,
  category: BrowseCategory,
  formaPolarities: Partial<Record<SlotId, Polarity>>,
): number {
  const auraSlotCount = getAuraSlotCount(category, item)
  const normalSlotCount = getNormalSlotCount(category)
  return calculateFormaCount({
    auraInnates: getAuraPolarities(item, auraSlotCount),
    exilusInnate: getExilusInnatePolarity(item),
    stanceInnate: getStanceInnatePolarity(item),
    normalInnates: Array.from({ length: normalSlotCount }, (_, i) =>
      toPolarity(item.polarities?.[i]),
    ),
    formaPolarities,
  })
}
