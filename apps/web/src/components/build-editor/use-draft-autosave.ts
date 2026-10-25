import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  clearEditorDraft,
  saveEditorDraft,
  type EditorDraftPayload,
} from "@/lib/editor-draft"
import type { SavedVariant } from "@/lib/queries/build-query"

import { resetEditorCache } from "./editor-cache"
import type { EditorCapture } from "./editor-capture"
import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState } from "./use-build-slots"
import type { ItemExtras } from "./use-item-extras"

/**
 * Debounce the full editor state to localStorage so a refresh doesn't wipe
 * unsaved work. The first run is the hydration render (no user edit yet), so
 * skip it; after that, any change writes a draft. The draft is cleared on a
 * successful save and by the explicit Reset/Discard control. We intentionally
 * don't auto-clear on a manual revert-to-saved: that needed a baseline
 * snapshot that was wrong after a variant-switch remount (it got re-seeded to
 * the dirty state, so it could delete a live draft) — the visible badge plus
 * Reset/Discard cover bailing out instead.
 */
export function useDraftAutosave({
  storeKey,
  storedDraft,
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
}: {
  storeKey: string
  storedDraft: EditorDraftPayload | null
  localDraft: EditorDraftPayload | null
  isUpdate: boolean
  capture: EditorCapture
  buildName: string
  guide: { buildSummary: string; buildDescription: string }
  slots: BuildSlotsState
  arcanes: ArcaneSlotsState
  extras: ItemExtras
  variants: SavedVariant[]
  clampedActiveIndex: number
}) {
  // Whether an autosaved draft is currently overriding the saved build. Seeded
  // from `storedDraft` (which survives variant-switch remounts, where
  // localDraft is intentionally null) and kept in sync by the autosave effect.
  const [hasDraft, setHasDraft] = useState(() => storedDraft !== null)
  const draftInitializedRef = useRef(false)

  useEffect(() => {
    if (!draftInitializedRef.current) {
      draftInitializedRef.current = true
      return
    }
    const handle = window.setTimeout(() => {
      // Capture + serialize inside the debounce so a burst of edits costs one
      // snapshot per idle window, not one per keystroke.
      saveEditorDraft(storeKey, {
        buildData: capture.captureBuildData(),
        buildName,
        guideSummary: guide.buildSummary,
        guideDescription: guide.buildDescription,
      })
      setHasDraft(true)
    }, 600)
    return () => window.clearTimeout(handle)
    // Re-run on any edit. captureBuildData reads the values below; listing them
    // keeps the snapshot current without re-binding the helper in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    buildName,
    guide.buildSummary,
    guide.buildDescription,
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
    variants,
    clampedActiveIndex,
  ])

  // Clear the draft and reload so the editor re-hydrates from the saved build
  // (or a blank new build). A reload is the simplest way to reset the live
  // slot/arcane hooks, which only initialize at mount.
  const resetToSaved = () => {
    clearEditorDraft(storeKey)
    resetEditorCache()
    window.location.reload()
  }

  // Tell the user once, on the mount where we actually restored a draft, that
  // their unsaved edits came back — with a one-click bail-out.
  useEffect(() => {
    if (localDraft === null) return
    toast("Draft restored", {
      // Stable id dedupes StrictMode's double-invoked mount effect (and any
      // remount) into a single toast instead of stacking duplicates.
      id: `draft-restored:${storeKey}`,
      description: "Your unsaved edits from last time are back.",
      action: {
        label: isUpdate ? "Reset to saved" : "Discard",
        onClick: resetToSaved,
      },
    })
    // Fire once, for the restoring mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { hasDraft, resetToSaved }
}
