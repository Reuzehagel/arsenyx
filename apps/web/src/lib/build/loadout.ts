import type {
  PlacedArcane,
  PlacedMod,
  SavedBuildData,
  SlotId,
} from "@arsenyx/shared/warframe/build-data"
import type { Polarity, BrowseCategory } from "@arsenyx/shared/warframe/types"

import type { DetailItem } from "@/lib/catalog"

import { resolveInitialArcanes, type BuildLayout } from "./layout"
import { dropOrphanSlots } from "./slot-order"

/** The mod/forma/arcane part of one variant, fitted to the item's layout. */
export interface Loadout {
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  /** Exactly `layout.arcaneCount` entries. */
  arcanes: (PlacedArcane | null)[]
}

/** Saved variant data → the loadout the viewer renders and the editor seeds
 *  its slot hooks with: orphan slots dropped, arcanes re-bucketed and padded. */
export function loadoutFromSaved(
  saved: Pick<SavedBuildData, "slots" | "formaPolarities" | "arcanes">,
  item: Pick<DetailItem, "name" | "uniqueName">,
  category: BrowseCategory,
  layout: BuildLayout,
): Loadout {
  const arcanes = resolveInitialArcanes(item, category, saved.arcanes) ?? []
  return {
    placed: dropOrphanSlots(saved.slots ?? {}, layout),
    formaPolarities: dropOrphanSlots(saved.formaPolarities ?? {}, layout),
    arcanes: Array.from(
      { length: layout.arcaneCount },
      (_, i) => arcanes[i] ?? null,
    ),
  }
}
