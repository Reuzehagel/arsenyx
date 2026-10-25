import type { KitgunComponents } from "@arsenyx/shared/warframe/kitgun-data"
import type {
  DeploymentContext,
  LichBonusElement,
  Polarity,
} from "@arsenyx/shared/warframe/types"
import { useEffect, useRef, useState } from "react"

import { useHotkey } from "@/lib/hooks/hotkeys"
import type { HelminthAbility } from "@/lib/queries/helminth-query"
import type { PlacedShard } from "@/lib/shards"

import type { ArcaneSlotsState, PlacedArcane } from "./use-arcane-slots"
import type { BuildSlotsState, PlacedMod, SlotId } from "./use-build-slots"
import { useEditorHistory } from "./use-editor-history"
import type { ItemExtras } from "./use-item-extras"

// One undo/redo step: the full mutable editor state for the active variant
// plus the build-wide fields. Excludes the build name and guide prose (those
// keep their native textarea undo) and the variants array / active index
// (variant structure isn't undoable — a switch remounts and resets history).
type EditorHistorySnapshot = {
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  arcanes: (PlacedArcane | null)[]
  shards: (PlacedShard | null)[]
  hasReactor: boolean
  helminth: Record<number, HelminthAbility>
  zawComponents: { grip: string; link: string } | undefined
  kitgunComponents: KitgunComponents | undefined
  lichBonusElement: LichBonusElement | null
  incarnonEnabled: boolean
  incarnonPerks: (string | null)[]
  deploymentContext: DeploymentContext
}

// Field-wise reference equality. Sound because every snapshot field is a value
// or an immutably-replaced reference — never mutated in place.
function snapshotsEqual(
  a: EditorHistorySnapshot,
  b: EditorHistorySnapshot,
): boolean {
  return (Object.keys(a) as (keyof EditorHistorySnapshot)[]).every((k) =>
    Object.is(a[k], b[k]),
  )
}

/**
 * Undo / redo over the slot, arcane and extras state. Reads the live editor
 * state into a snapshot, and writes one back through every setter. The
 * recording effect feeds `commit`; the hotkeys and header buttons drive
 * `undo`/`redo`.
 */
export function useEditorUndo({
  slots,
  arcanes,
  extras,
}: {
  slots: BuildSlotsState
  arcanes: ArcaneSlotsState
  extras: ItemExtras
}) {
  const captureHistorySnapshot = (): EditorHistorySnapshot => ({
    placed: slots.placed,
    formaPolarities: slots.formaPolarities,
    arcanes: arcanes.placed,
    shards: extras.shards,
    hasReactor: extras.hasReactor,
    helminth: extras.helminth,
    zawComponents: extras.zawComponents,
    kitgunComponents: extras.kitgunComponents,
    lichBonusElement: extras.lichBonusElement,
    incarnonEnabled: extras.incarnonEnabled,
    incarnonPerks: extras.incarnonPerks,
    deploymentContext: extras.deploymentContext,
  })

  const applyHistorySnapshot = (s: EditorHistorySnapshot) => {
    slots.setPlaced(s.placed)
    slots.setFormaPolarities(s.formaPolarities)
    arcanes.setPlaced(s.arcanes)
    extras.setShards(s.shards)
    extras.setHasReactor(s.hasReactor)
    extras.setHelminth(s.helminth)
    extras.setZawComponents(s.zawComponents)
    extras.setKitgunComponents(s.kitgunComponents)
    extras.setLichBonusElement(s.lichBonusElement)
    extras.setIncarnonEnabled(s.incarnonEnabled)
    extras.setIncarnonPerks(s.incarnonPerks)
    extras.setDeploymentContext(s.deploymentContext)
  }

  // Seed the baseline from the mount snapshot (lazy init runs once). Every
  // field is an immutable value/reference owned by a setState, so a real edit
  // always swaps at least one reference — a field-wise `Object.is` sweep tells
  // a genuine change apart from a no-op re-record without deep-walking mods.
  const [historyInitial] = useState(captureHistorySnapshot)
  const history = useEditorHistory(
    historyInitial,
    applyHistorySnapshot,
    snapshotsEqual,
  )

  // Record edits into history, debounced so a burst (held +/-, drag, rapid
  // clicks) collapses to one undo step. Mirrors the autosave effect's dep list
  // minus the text/structure fields the snapshot intentionally omits.
  const historyInitializedRef = useRef(false)
  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true
      return
    }
    const snapshot = captureHistorySnapshot()
    // An undo/redo apply lands here too — consume it so it isn't re-recorded.
    if (history.consumeApply(snapshot)) return
    const handle = window.setTimeout(() => history.commit(snapshot), 500)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slots.placed,
    slots.formaPolarities,
    arcanes.placed,
    extras.shards,
    extras.hasReactor,
    extras.helminth,
    extras.zawComponents,
    extras.kitgunComponents,
    extras.lichBonusElement,
    extras.incarnonEnabled,
    extras.incarnonPerks,
    extras.deploymentContext,
  ])

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y on Windows) redoes. Left to
  // fire only outside text fields (allowInEditable defaults false), so the name
  // and guide inputs keep their native per-keystroke undo.
  useHotkey("mod+z", () => history.undo())
  useHotkey("mod+shift+z", () => history.redo())
  useHotkey("mod+y", () => history.redo())

  return history
}
