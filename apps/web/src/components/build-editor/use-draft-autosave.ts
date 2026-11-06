import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type { ExtrasState } from "@/lib/build/extras"
import {
  clearEditorDraft,
  clearImportDraft,
  saveEditorDraft,
  type EditorDraftPayload,
} from "@/lib/drafts"

import type { EditorCapture } from "./editor-capture"
import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState } from "./use-build-slots"

/**
 * Debounce the full editor state to localStorage so a refresh doesn't wipe
 * unsaved work. The first run is the hydration render (no user edit yet), so
 * skip it; after that, any change writes a draft. The draft is cleared on a
 * successful save and by the explicit Reset/Discard control; a manual
 * revert-to-saved doesn't auto-clear it — the visible badge plus Reset/Discard
 * cover bailing out instead.
 *
 * A share link or import (`adoption`) is written as the draft on mount and the
 * URL drops it (`onAdopted`), so the session is an ordinary new-build session
 * from then on and a refresh restores it. A draft it replaced is offered back
 * in a toast.
 */
export function useDraftAutosave({
  storeKey,
  localDraft,
  isUpdate,
  capture,
  buildName,
  guide,
  slots,
  arcanes,
  extras,
  variants,
  clampedActiveIndex,
  onResetToSaved,
  adoption,
  onAdopted,
}: {
  storeKey: string
  localDraft: EditorDraftPayload | null
  isUpdate: boolean
  capture: EditorCapture
  buildName: string
  guide: { buildSummary: string; buildDescription: string }
  slots: BuildSlotsState
  arcanes: ArcaneSlotsState
  extras: ExtrasState
  variants: SavedVariant[]
  clampedActiveIndex: number
  /** Re-create the editor session; called after the draft is dropped. */
  onResetToSaved: () => void
  adoption: {
    replaced: EditorDraftPayload | null
    importId: string | undefined
  } | null
  onAdopted?: () => void
}) {
  // Whether an autosaved draft is currently overriding the saved build.
  const [hasDraft, setHasDraft] = useState(
    () => localDraft !== null || adoption !== null,
  )

  const snapshot = (): EditorDraftPayload => ({
    buildData: capture.captureBuildData(),
    buildName,
    guideSummary: guide.buildSummary,
    guideDescription: guide.buildDescription,
  })

  // Re-run on any edit. captureBuildData reads the values below; listing them
  // keeps the snapshot current without re-binding the helper in deps.
  const deps = [
    buildName,
    guide.buildSummary,
    guide.buildDescription,
    slots.placed,
    slots.formaPolarities,
    arcanes.placed,
    extras,
    variants,
    clampedActiveIndex,
  ]
  // Write only when a dep actually changed since the last run. A "skip the
  // first run" flag isn't enough: StrictMode re-runs mount effects with the ref
  // already set, which saved a draft for an untouched editor.
  const lastDepsRef = useRef(deps)

  useEffect(() => {
    const changed = deps.some((d, i) => !Object.is(d, lastDepsRef.current[i]))
    lastDepsRef.current = deps
    if (!changed) return
    const handle = window.setTimeout(() => {
      // Capture + serialize inside the debounce so a burst of edits costs one
      // snapshot per idle window, not one per keystroke.
      saveEditorDraft(storeKey, snapshot())
      setHasDraft(true)
    }, 600)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Clear the draft, then have the owner re-create the session so it
  // re-hydrates from the saved build (or a blank new build).
  const toastId = `draft-restored:${storeKey}`
  const resetToSaved = () => {
    clearEditorDraft(storeKey)
    toast.dismiss(toastId)
    onResetToSaved()
  }

  // Tell the user once, on the mount where we actually restored a draft, that
  // their unsaved edits came back — with a one-click bail-out.
  useEffect(() => {
    if (localDraft === null) return
    toast("Draft restored", {
      // Stable id dedupes StrictMode's double-invoked mount effect into a
      // single toast instead of stacking duplicates.
      id: toastId,
      description: "Your unsaved edits from last time are back.",
      action: {
        label: isUpdate ? "Reset to saved" : "Discard",
        onClick: resetToSaved,
      },
    })
    // Fire once, for the restoring mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!adoption) return
    saveEditorDraft(storeKey, snapshot())
    if (adoption.importId) clearImportDraft(adoption.importId)
    onAdopted?.()
    const { replaced } = adoption
    if (!replaced) return
    toast("Replaced your unsaved draft", {
      id: `draft-replaced:${storeKey}`,
      description: "This build took the place of your draft for this item.",
      duration: 10_000,
      action: {
        label: "Restore it",
        onClick: () => {
          saveEditorDraft(storeKey, replaced)
          onResetToSaved()
        },
      },
    })
    // Once, for the adopting mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { hasDraft, resetToSaved }
}
