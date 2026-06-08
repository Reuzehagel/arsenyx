import { createSyntheticRiven } from "@arsenyx/shared/warframe/rivens"
import { type Mod } from "@arsenyx/shared/warframe/types"
import { useState, type ReactElement } from "react"

import {
  RivenDialog,
  type BuildSlotsState,
  type RivenDialogValues,
  type SlotId,
} from "@/components/build-editor"
import { type BrowseCategory } from "@/lib/warframe"

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
  openForPlacement: () => void
  openForEdit: (slotId: SlotId) => void
  dialog: ReactElement | null
} {
  const [rivenEdit, setRivenEdit] = useState<RivenEditState | null>(null)

  const openForPlacement = () => {
    const target = findFreeNormalSlot(slots, normalSlotCount)
    if (!target) return
    setRivenEdit({ slotId: target, initial: undefined })
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
    slots.placeAt(rivenEdit.slotId, mod, base.fusionLimit)
    // placeAt doesn't move the cursor; advance past the placed riven so the
    // next mod click lands in an empty slot instead of overwriting it.
    slots.selectNextEmpty(rivenEdit.slotId)
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

function findFreeNormalSlot(
  slots: BuildSlotsState,
  normalSlotCount: number,
): SlotId | null {
  // Only reuse the active selection if it's a normal mod slot — rivens never
  // go in aura/exilus/stance. (Was comparing against "aura", which isn't a
  // SlotId: aura slots are `aura-N`, so that guard never fired.)
  if (
    slots.selected &&
    slots.selected.startsWith("normal-") &&
    !slots.placed[slots.selected]
  ) {
    return slots.selected
  }
  for (let i = 0; i < normalSlotCount; i++) {
    const id = `normal-${i}` as SlotId
    if (!slots.placed[id]) return id
  }
  return null
}
