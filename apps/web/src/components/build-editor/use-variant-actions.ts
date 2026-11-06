import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"
import { MAX_VARIANTS } from "@arsenyx/shared/warframe/build-doc"

import { foldedVariants, type SetVariants } from "@/lib/build/variants"

interface VariantActions {
  switchVariant: (i: number) => void
  addVariant: () => void
  duplicateActive: (label?: string) => void
  deleteActive: () => void
  renameActive: (label: string) => void
  /** Twin-frames (Sirius & Orion): switch the top-level form axis. Snapshots
   *  the current form's edits, then jumps to the target form's first variant
   *  (creating one if that form has none). */
  switchForm: (formIndex: number) => void
}

/**
 * The variant CRUD handlers (switch / add / duplicate / delete / rename). Each
 * snapshots the active variant's live edits back into the array first
 * (`captureActiveSnapshot`), then hands the new array and the variant to land
 * on to `activate`, which re-seeds the live editor state.
 */
export function useVariantActions(opts: {
  variants: SavedVariant[]
  setVariants: SetVariants
  clampedActiveIndex: number
  captureActiveSnapshot: () => SavedVariant
  activate: (next: SavedVariant[], index: number) => void
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
    activate,
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
    // Explicit empty set so a freshly-added variant starts with NO shards
    // (independent), rather than copy-on-load inheriting the build's set.
    shards: [],
    formIndex,
  })

  const switchVariant = (i: number) => {
    if (i === clampedActiveIndex) return
    activate(
      foldedVariants(variants, clampedActiveIndex, captureActiveSnapshot()),
      i,
    )
  }

  const addVariant = () => {
    if (formCount >= MAX_VARIANTS) return
    const seeded = foldedVariants(
      variants,
      clampedActiveIndex,
      captureActiveSnapshot(),
    )
    const blank = makeBlankVariant(`Variant ${formCount + 1}`, activeFormIndex)
    activate([...seeded, blank], seeded.length)
  }

  const duplicateActive = (label?: string) => {
    if (formCount >= MAX_VARIANTS) return
    const live = captureActiveSnapshot()
    const snapshot = label === undefined ? live : { ...live, label }
    // `...snapshot` carries the active variant's formIndex, so the copy stays
    // in the same form.
    const dup: SavedVariant = {
      ...snapshot,
      id: newVariantId(),
      label: `${snapshot.label} (copy)`,
    }
    const seeded = foldedVariants(variants, clampedActiveIndex, snapshot)
    const insertAt = clampedActiveIndex + 1
    activate(
      [...seeded.slice(0, insertAt), dup, ...seeded.slice(insertAt)],
      insertAt,
    )
  }

  const deleteActive = () => {
    // Keep at least one variant per form so every form stays representable.
    if (formCount <= 1) return
    const next = variants.filter((_, i) => i !== clampedActiveIndex)
    // Land on another variant of the SAME form (guaranteed to exist since
    // formCount > 1), not whatever slides into the old global index.
    const sameForm = next.findIndex((v) => formOf(v) === activeFormIndex)
    activate(next, sameForm < 0 ? 0 : sameForm)
  }

  /** `label` arrives normalized by the variant bar. */
  const renameActive = (label: string) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === clampedActiveIndex ? { ...v, label } : v)),
    )
  }

  const switchForm = (formIndex: number) => {
    if (formIndex === activeFormIndex) return
    const captured = foldedVariants(
      variants,
      clampedActiveIndex,
      captureActiveSnapshot(),
    )
    const target = captured.findIndex((v) => formOf(v) === formIndex)
    if (target >= 0) {
      activate(captured, target)
      return
    }
    // Target form has no variants yet (e.g. an imported build missing a form)
    // — seed a blank one so the form is always reachable.
    activate(
      [...captured, makeBlankVariant("Variant 1", formIndex)],
      captured.length,
    )
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
