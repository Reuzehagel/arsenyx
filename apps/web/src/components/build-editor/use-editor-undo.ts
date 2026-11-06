import type {
  PlacedArcane,
  PlacedMod,
  SlotId,
} from "@arsenyx/shared/warframe/build-data"
import type { Polarity } from "@arsenyx/shared/warframe/types"
import { useEffect, useRef, useState } from "react"

import type { ExtrasState } from "@/lib/build/extras"
import { HOTKEYS, useHotkey } from "@/lib/hooks/hotkeys"

import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState } from "./use-build-slots"
import { useEditorHistory } from "./use-editor-history"

// One undo/redo step: the active variant's loadout plus the extras record.
// Excludes the build name and guide prose (native textarea undo) and the
// variants array (a variant switch resets history).
export type EditorHistorySnapshot = {
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  arcanes: (PlacedArcane | null)[]
  extras: ExtrasState
}

// Field-wise reference equality. Sound because every field is an immutably
// replaced reference — never mutated in place.
function snapshotsEqual(
  a: EditorHistorySnapshot,
  b: EditorHistorySnapshot,
): boolean {
  return (Object.keys(a) as (keyof EditorHistorySnapshot)[]).every((k) =>
    Object.is(a[k], b[k]),
  )
}

/** Undo / redo over the slot, arcane and extras state, debounced so a burst
 *  of edits (held +/-, drag, rapid clicks) is one step. */
export function useEditorUndo({
  slots,
  arcanes,
  extras,
  setExtras,
}: {
  slots: BuildSlotsState
  arcanes: ArcaneSlotsState
  extras: ExtrasState
  setExtras: (next: ExtrasState) => void
}) {
  const capture = (): EditorHistorySnapshot => ({
    placed: slots.placed,
    formaPolarities: slots.formaPolarities,
    arcanes: arcanes.placed,
    extras,
  })

  const apply = (s: EditorHistorySnapshot) => {
    slots.setPlaced(s.placed)
    slots.setFormaPolarities(s.formaPolarities)
    arcanes.setPlaced(s.arcanes)
    setExtras(s.extras)
  }

  const [historyInitial] = useState(capture)
  const history = useEditorHistory(historyInitial, apply, snapshotsEqual)

  const historyInitializedRef = useRef(false)
  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true
      return
    }
    const snapshot = capture()
    // An undo/redo apply lands here too — consume it so it isn't re-recorded.
    if (history.consumeApply(snapshot)) return
    const handle = window.setTimeout(() => history.commit(snapshot), 500)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.placed, slots.formaPolarities, arcanes.placed, extras])

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y on Windows) redoes — only
  // outside text fields, so the name and guide inputs keep native undo.
  useHotkey(HOTKEYS.undo, () => history.undo())
  useHotkey(HOTKEYS.redo, () => history.redo())

  return history
}
