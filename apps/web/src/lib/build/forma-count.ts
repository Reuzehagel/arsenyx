import type { SlotId } from "@arsenyx/shared/warframe/build-data"
import type { Polarity, BrowseCategory } from "@arsenyx/shared/warframe/types"

import type { DetailItem } from "@/lib/catalog"

import { calculateFormaCount } from "./calculations"
import { getInnatePolarities } from "./polarities"

/**
 * Forma count for a build: the item's innate polarities vs the user's per-slot
 * forma. The editor, the import debug view, and the offline recompute backfill
 * (scripts/recompute-forma.ts) all call this, so a card's count always
 * matches the detail page.
 */
export function computeFormaCount(
  item: DetailItem,
  category: BrowseCategory,
  formaPolarities: Partial<Record<SlotId, Polarity>>,
  formIndex?: number,
): number {
  return calculateFormaCount({
    innates: getInnatePolarities(item, category, formIndex),
    formaPolarities,
  })
}
