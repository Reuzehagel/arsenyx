import { normalSlotId, type SlotId } from "@arsenyx/shared/warframe/build-data"
import { createSyntheticRiven } from "@arsenyx/shared/warframe/rivens"
import type { Mod, BrowseCategory } from "@arsenyx/shared/warframe/types"
import { useState, type ReactElement } from "react"

import { canPlaceIn, candidateSlots } from "@/lib/build/slot-kind"

import { RivenDialog, type RivenDialogValues } from "./riven-dialog"
import type { BuildSlotsState } from "./use-build-slots"

interface RivenEditState {
  slotId: SlotId
  initial?: Partial<RivenDialogValues>
}

/**
 * Owns the riven-dialog state and renders the dialog when open. Returns
 * imperative open/edit handlers plus a `dialog` ReactElement the caller
 * mounts unconditionally — null when no riven flow is active.
 */
export function useRivenDialog({
  slots,
  normalSlotCount,
  category,
}: {
  slots: BuildSlotsState
  normalSlotCount: number
  category: BrowseCategory
}): {
  /** False when there's no free slot for a Riven. */
  openForPlacement: () => boolean
  openForEdit: (slotId: SlotId) => void
  dialog: ReactElement | null
} {
  const [rivenEdit, setRivenEdit] = useState<RivenEditState | null>(null)

  const openForPlacement = () => {
    const target = rivenTarget(slots, normalSlotCount)
    if (!target) return false
    setRivenEdit({ slotId: target, initial: undefined })
    return true
  }

  const openForEdit = (slotId: SlotId) => {
    const placed = slots.placed[slotId]
    if (!placed) return
    setRivenEdit({
      slotId,
      initial: {
        polarity: placed.mod.polarity,
        drain: placed.mod.baseDrain,
        rivenStats: placed.mod.rivenStats,
      },
    })
  }

  const confirmRiven = (values: RivenDialogValues) => {
    if (!rivenEdit) return
    const base = createSyntheticRiven()
    const mod: Mod = {
      ...base,
      polarity: values.polarity,
      baseDrain: values.drain,
      rivenStats: values.rivenStats,
    }
    const editing = rivenEdit.initial ? slots.placed[rivenEdit.slotId] : null
    // Editing keeps the riven's rank (fixing a typo shouldn't max it) and the
    // cursor where it is; a new riven starts maxed and moves the cursor on.
    slots.placeAt(
      rivenEdit.slotId,
      mod,
      editing ? Math.min(editing.rank, base.fusionLimit) : base.fusionLimit,
    )
    if (!editing) slots.selectNextEmpty(rivenEdit.slotId)
    setRivenEdit(null)
  }

  const dialog = rivenEdit ? (
    <RivenDialog
      key={rivenEdit.slotId}
      open={true}
      onOpenChange={(o) => {
        if (!o) setRivenEdit(null)
      }}
      category={category}
      initialValues={rivenEdit.initial}
      onConfirm={confirmRiven}
    />
  ) : null

  return { openForPlacement, openForEdit, dialog }
}

/** Where a new riven goes: the selected slot when it's free and fits a
 *  riven, else the first free slot that does — never over an equipped mod. */
function rivenTarget(
  slots: BuildSlotsState,
  normalSlotCount: number,
): SlotId | null {
  const riven = createSyntheticRiven()
  const free = (id: SlotId) => !slots.placed[id] && canPlaceIn(riven, id)
  if (slots.selected && free(slots.selected)) return slots.selected
  const normalIds = Array.from({ length: normalSlotCount }, (_, i) =>
    normalSlotId(i),
  )
  return candidateSlots(riven, [], normalIds).find(free) ?? null
}
