import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"
import { useState } from "react"

import type { SetVariants } from "@/lib/build/variants"

/** Which guide the editor is writing: the build-wide one or a variant's. */
type GuideScope = { kind: "build" } | { kind: "variant"; index: number }

/** The scope-aware props the GuideEditor consumes. */
export interface GuideEditorProps {
  summary: string
  onSummaryChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  scopes: {
    id: string
    label: string
    hasContent: boolean
    /** Twin-frames: which form this variant belongs to, so the guide picker
     *  can group chips by form. */
    formIndex?: number
  }[]
  activeScope: GuideScope
  onScopeChange: (scope: GuideScope) => void
  /** Copy the build-wide guide into a variant that has none yet — used when
   *  enabling per-variant guides so existing text isn't seemingly lost. */
  seedVariantFromBuild: (index: number) => void
}

interface GuideState {
  /** Build-wide guide — persisted to buildData on save / autosave.
   *  (Per-variant guides live in `variants[i]`.) */
  buildSummary: string
  buildDescription: string
  /** Ready-made GuideEditor props, scoped to the build or the active variant. */
  editorProps: GuideEditorProps
  /** Keep a variant scope on the same variant when the array is about to
   *  become `next` (indices shift on add/delete); a deleted one falls back to
   *  the first variant. */
  followVariants: (next: SavedVariant[]) => void
}

/**
 * Owns the build editor's guide state: the build-wide summary/description, the
 * edit scope (build-wide vs a specific variant), and the scope-aware read/write
 * dispatch the GuideEditor needs. Per-variant guides live in `variants[i]` and
 * are written through `setVariants`; the build-wide guide is local state,
 * surfaced via `buildSummary`/`buildDescription` for the save / share /
 * autosave paths.
 */
export function useGuideState(opts: {
  initialSummary: string
  initialDescription: string
  variants: SavedVariant[]
  setVariants: SetVariants
}): GuideState {
  const { initialSummary, initialDescription, variants, setVariants } = opts
  const [buildSummary, setBuildSummary] = useState(initialSummary)
  const [buildDescription, setBuildDescription] = useState(initialDescription)
  const [scope, setScope] = useState<GuideScope>({ kind: "build" })

  const summary =
    scope.kind === "build"
      ? buildSummary
      : (variants[scope.index]?.guideSummary ?? "")
  const description =
    scope.kind === "build"
      ? buildDescription
      : (variants[scope.index]?.guideDescription ?? "")

  const onSummaryChange = (v: string): void => {
    if (scope.kind === "build") {
      setBuildSummary(v)
      return
    }
    const idx = scope.index
    setVariants((prev) =>
      prev.map((sv, i) => (i === idx ? { ...sv, guideSummary: v } : sv)),
    )
  }
  const onDescriptionChange = (v: string): void => {
    if (scope.kind === "build") {
      setBuildDescription(v)
      return
    }
    const idx = scope.index
    setVariants((prev) =>
      prev.map((sv, i) => (i === idx ? { ...sv, guideDescription: v } : sv)),
    )
  }

  // Carry the build-wide guide into a variant the first time it's edited
  // per-variant. Only seeds an empty variant guide, so re-toggling never
  // clobbers text the user already wrote for that variant.
  const seedVariantFromBuild = (index: number): void => {
    setVariants((prev) =>
      prev.map((sv, i) => {
        if (i !== index) return sv
        // Seed each field independently: a variant with only a summary should
        // still get the build-wide description carried into its empty one.
        const hasSummary = Boolean(sv.guideSummary && sv.guideSummary.trim())
        const hasDescription = Boolean(
          sv.guideDescription && sv.guideDescription.trim(),
        )
        if (hasSummary && hasDescription) return sv
        return {
          ...sv,
          guideSummary: hasSummary ? sv.guideSummary : buildSummary,
          guideDescription: hasDescription
            ? sv.guideDescription
            : buildDescription,
        }
      }),
    )
  }

  const scopes = variants.map((v) => ({
    id: v.id,
    label: v.label,
    formIndex: v.formIndex,
    hasContent: Boolean(
      (v.guideSummary && v.guideSummary.trim()) ||
      (v.guideDescription && v.guideDescription.trim()),
    ),
  }))

  const followVariants = (next: SavedVariant[]): void => {
    if (scope.kind !== "variant") return
    const id = variants[scope.index]?.id
    setScope({
      kind: "variant",
      index: Math.max(
        0,
        next.findIndex((v) => v.id === id),
      ),
    })
  }

  return {
    buildSummary,
    buildDescription,
    followVariants,
    editorProps: {
      summary,
      onSummaryChange,
      description,
      onDescriptionChange,
      scopes,
      activeScope: scope,
      onScopeChange: setScope,
      seedVariantFromBuild,
    },
  }
}
