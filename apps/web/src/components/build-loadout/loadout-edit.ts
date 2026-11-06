import type { SlotId } from "@arsenyx/shared/warframe/build-data"
import type { Arcane, Polarity } from "@arsenyx/shared/warframe/types"

/** Editing handles for the mod grid. The editor's slot hook satisfies this;
 *  the read-only viewer passes no edit at all. */
interface ModSlotsEdit {
  selected: SlotId | null
  select: (id: SlotId | null) => void
  remove: (id: SlotId) => void
  setRank: (id: SlotId, rank: number) => void
  setForma: (id: SlotId, polarity: Polarity | null) => void
  removeAlternate: (id: SlotId) => void
}

export interface ArcaneSlotsEdit {
  selected: number | null
  usedNames: Set<string>
  select: (index: number | null) => void
  placeAt: (index: number, arcane: Arcane) => void
  remove: (index: number) => void
  setRank: (index: number, rank: number) => void
}

export interface LoadoutEdit {
  slots: ModSlotsEdit
  arcanes: ArcaneSlotsEdit
  onEditRiven: (id: SlotId) => void
  /** Open the picker in alternate mode for a filled slot. */
  onAddAlternate: (id: SlotId) => void
}
