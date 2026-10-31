import type { KitgunComponents } from "@arsenyx/shared/warframe/kitgun-data"
import type { LichBonusElement, Polarity } from "@arsenyx/shared/warframe/types"

import type { SavedVariant } from "@/lib/queries/build-query"

// ─── In-memory editor cache ─────────────────────────────────────────────────
//
// Survives EditorShell remounts (the editor is re-keyed on variant switch
// so per-variant hooks can re-initialize from the new variant's data).
// Single-entry cache keyed by buildSlug — replaced when editing a different
// build. Routes that mount EditorShell are responsible for calling
// `resetEditorCache()` on unmount so navigation away from /create doesn't
// leave stale variants in memory.

export type SharedEditorOverrides = {
  hasReactor?: boolean
  zawComponents?: { grip: string; link: string } | undefined
  kitgunComponents?: KitgunComponents | undefined
  lichBonusElement?: LichBonusElement | null
  formaPolarities?: Partial<Record<string, Polarity>>
  buildName?: string
  guideSummary?: string
  guideDescription?: string
}

// A holder object rather than a bare `let` so the editor hooks that write it
// (they live in separate modules) can reassign `.current`.
export const editorCache: {
  current: {
    key: string
    data: SavedVariant[]
    shared?: SharedEditorOverrides
  } | null
} = { current: null }

export function resetEditorCache() {
  editorCache.current = null
}

// ─── Variant structural epoch ───────────────────────────────────────────────
//
// EditorShell is re-keyed on `${build}-${v}` (see create.tsx) so the
// per-variant hooks re-initialize from the projected variant on a switch. But
// `?v` is an *index*, and deleting a non-last active variant slides the next
// variant into that same index — `?v` is unchanged, no remount fires, and the
// slot/arcane hooks keep showing the deleted variant's data.
//
// This monotonic counter closes that gap: structural mutations (add / delete /
// duplicate) bump it, CreatePage subscribes via useSyncExternalStore and folds
// it into the key, so any structural change forces a clean remount regardless
// of whether the index moved. A module-level store (not React state) because
// the value has to be readable by CreatePage, which is a sibling above the
// component that mutates it.
let variantEpoch = 0
const variantEpochListeners = new Set<() => void>()

export function subscribeVariantEpoch(onChange: () => void): () => void {
  variantEpochListeners.add(onChange)
  return () => variantEpochListeners.delete(onChange)
}

export function getVariantEpoch(): number {
  return variantEpoch
}

export function bumpVariantEpoch() {
  variantEpoch += 1
  for (const listener of variantEpochListeners) listener()
}
