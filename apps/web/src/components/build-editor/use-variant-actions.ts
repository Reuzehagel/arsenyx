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
  /** Twin-frames (Sirius & Orion): switch the top-level form axis. Snapshots
   *  the current form's edits, then jumps to the target form's first variant
   *  (creating one if that form has none). */
  switchForm: (formIndex: number) => void
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
  /** Twin-frames: the form whose variants are currently shown. Variant CRUD
   *  is scoped to this form (its own MAX_VARIANTS budget). 0 for normal
   *  frames (all variants share form 0). */
  activeFormIndex: number
}): VariantActions {
  const {
    variants,
    setVariants,
    clampedActiveIndex,
    captureActiveSnapshot,
    navigate,
    bumpVariantEpoch,
    activeFormIndex,
  } = opts

  const formOf = (v: SavedVariant) => v.formIndex ?? 0
  // Variants belonging to the active form — the per-form budget + tab set.
  const formCount = variants.filter((v) => formOf(v) === activeFormIndex).length

  const newVariantId = () =>
    `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

  const makeBlankVariant = (
    label: string,
    formIndex: number,
  ): SavedVariant => ({
    id: newVariantId(),
    label,
    slots: {},
    arcanes: [],
    formIndex,
  })

  // Share-aware `?v` write: when `share` is in the URL, an explicit `v: 0`
  // keeps the user's choice from being overridden by the share's activeIndex.
  const gotoVariant = (i: number) =>
    navigate({
      to: ".",
      search: (s) => ({ ...s, v: i === 0 && !s.share ? undefined : i }),
      replace: true,
    })

  const switchVariant = (i: number) => {
    if (i === clampedActiveIndex) return
    const snapshot = captureActiveSnapshot()
    const next = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    setVariants(next)
    // `gotoVariant` carries the share-aware `?v` write: when `share` is in the
    // URL, `v: undefined` would let validateSearch's `activeVariantFromShare`
    // fallback re-derive v from the share's encoded activeIndex (silently
    // overriding the user's click back to variant 0), so it emits explicit
    // `v: 0` in that case and a clean `v: undefined` when share is absent.
    gotoVariant(i)
  }

  const addVariant = () => {
    if (formCount >= MAX_VARIANTS) return
    const snapshot = captureActiveSnapshot()
    const seeded = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    const blank = makeBlankVariant(`Variant ${formCount + 1}`, activeFormIndex)
    const next = [...seeded, blank]
    setVariants(next)
    gotoVariant(next.length - 1)
    bumpVariantEpoch()
  }

  const duplicateActive = () => {
    if (formCount >= MAX_VARIANTS) return
    const snapshot = captureActiveSnapshot()
    // `...snapshot` carries the active variant's formIndex, so the copy stays
    // in the same form.
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
    gotoVariant(insertAt)
    bumpVariantEpoch()
  }

  const deleteActive = () => {
    // Keep at least one variant per form so every form stays representable.
    if (formCount <= 1) return
    const next = variants.filter((_, i) => i !== clampedActiveIndex)
    setVariants(next)
    // Land on another variant of the SAME form (guaranteed to exist since
    // formCount > 1), not whatever slides into the old global index.
    const sameForm = next.findIndex((v) => formOf(v) === activeFormIndex)
    gotoVariant(sameForm < 0 ? 0 : sameForm)
    // Deleting a non-last active variant can keep `?v` unchanged (the next
    // variant slides into this index), so the navigate alone won't remount.
    bumpVariantEpoch()
  }

  const renameActive = (label: string) => {
    const trimmed = label.trim().slice(0, 24) || `Variant ${formCount}`
    setVariants((prev) =>
      prev.map((v, i) =>
        i === clampedActiveIndex ? { ...v, label: trimmed } : v,
      ),
    )
  }

  const switchForm = (formIndex: number) => {
    if (formIndex === activeFormIndex) return
    const snapshot = captureActiveSnapshot()
    const captured = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    const target = captured.findIndex((v) => formOf(v) === formIndex)
    if (target >= 0) {
      setVariants(captured)
      gotoVariant(target)
      bumpVariantEpoch()
      return
    }
    // Target form has no variants yet (e.g. an imported build missing a form)
    // — seed a blank one so the form is always reachable.
    const blank = makeBlankVariant("Variant 1", formIndex)
    const next = [...captured, blank]
    setVariants(next)
    gotoVariant(next.length - 1)
    bumpVariantEpoch()
  }

  return {
    switchVariant,
    addVariant,
    duplicateActive,
    deleteActive,
    renameActive,
    switchForm,
  }
}
