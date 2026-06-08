import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"
import type { useNavigate } from "@tanstack/react-router"

import type { SavedVariant } from "@/lib/queries/build-query"

type SetVariants = (
  next: SavedVariant[] | ((prev: SavedVariant[]) => SavedVariant[]),
) => void

export interface VariantActions {
  switchVariant: (i: number) => void
  addVariant: () => void
  duplicateActive: () => void
  deleteActive: () => void
  renameActive: (label: string) => void
}

/**
 * The variant CRUD handlers (switch / add / duplicate / delete / rename). Pulled
 * out of editor-shell as a cohesive group, but deliberately kept thin: the
 * variants state, the module cache it writes through (`setVariants`), and the
 * structural epoch all stay in the composition root — those carry subtle
 * remount/race semantics best kept co-located. This hook just sequences
 * snapshot → mutate → navigate for each action.
 *
 * Each mutation snapshots the active variant's live edits back into the array
 * first (`captureActiveSnapshot`), then updates `?v` so the EditorShell remount
 * re-hydrates from the right variant. Structural changes (add/duplicate/delete)
 * also bump the epoch so a delete that leaves `?v` unchanged still remounts.
 */
export function useVariantActions(opts: {
  variants: SavedVariant[]
  setVariants: SetVariants
  clampedActiveIndex: number
  captureActiveSnapshot: () => SavedVariant
  navigate: ReturnType<typeof useNavigate>
  bumpVariantEpoch: () => void
}): VariantActions {
  const {
    variants,
    setVariants,
    clampedActiveIndex,
    captureActiveSnapshot,
    navigate,
    bumpVariantEpoch,
  } = opts

  const newVariantId = () =>
    `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

  const switchVariant = (i: number) => {
    if (i === clampedActiveIndex) return
    const snapshot = captureActiveSnapshot()
    const next = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    setVariants(next)
    navigate({
      to: ".",
      // When `share` is in the URL, `v: undefined` lets validateSearch's
      // `activeVariantFromShare` fallback re-derive v from the share's
      // encoded activeIndex — which silently overrides the user's click
      // back to variant 0. Emit explicit `v: 0` in that case so the user's
      // choice wins. Clean `v: undefined` when share is absent.
      search: (s) => ({ ...s, v: i === 0 && !s.share ? undefined : i }),
      replace: true,
    })
  }

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return
    const snapshot = captureActiveSnapshot()
    const seeded = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    const blank: SavedVariant = {
      id: newVariantId(),
      label: `Variant ${seeded.length + 1}`,
      slots: {},
      arcanes: [],
    }
    const next = [...seeded, blank]
    setVariants(next)
    navigate({
      to: ".",
      search: (s) => ({ ...s, v: next.length - 1 }),
      replace: true,
    })
    bumpVariantEpoch()
  }

  const duplicateActive = () => {
    if (variants.length >= MAX_VARIANTS) return
    const snapshot = captureActiveSnapshot()
    const dup: SavedVariant = {
      ...snapshot,
      id: newVariantId(),
      label: `${snapshot.label} (copy)`,
    }
    const seeded = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    const insertAt = clampedActiveIndex + 1
    const next = [...seeded.slice(0, insertAt), dup, ...seeded.slice(insertAt)]
    setVariants(next)
    navigate({
      to: ".",
      search: (s) => ({ ...s, v: insertAt === 0 ? undefined : insertAt }),
      replace: true,
    })
    bumpVariantEpoch()
  }

  const deleteActive = () => {
    if (variants.length <= 1) return
    const next = variants.filter((_, i) => i !== clampedActiveIndex)
    setVariants(next)
    const newIdx = Math.min(clampedActiveIndex, next.length - 1)
    navigate({
      to: ".",
      // Same share-aware fallback as switchVariant.
      search: (s) => ({
        ...s,
        v: newIdx === 0 && !s.share ? undefined : newIdx,
      }),
      replace: true,
    })
    // Deleting a non-last active variant keeps `?v` unchanged (the next
    // variant slides into this index), so the navigate alone won't remount.
    // Bump the epoch to force the re-hydration regardless.
    bumpVariantEpoch()
  }

  const renameActive = (label: string) => {
    const trimmed =
      label.trim().slice(0, 24) || `Variant ${clampedActiveIndex + 1}`
    setVariants((prev) =>
      prev.map((v, i) =>
        i === clampedActiveIndex ? { ...v, label: trimmed } : v,
      ),
    )
  }

  return {
    switchVariant,
    addVariant,
    duplicateActive,
    deleteActive,
    renameActive,
  }
}
