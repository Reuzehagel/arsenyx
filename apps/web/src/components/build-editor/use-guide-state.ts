import { useState } from "react"

import type { SavedVariant } from "@/lib/queries/build-query"

import type { GuideScope } from "./guide-editor"

type SetVariants = (
  next: SavedVariant[] | ((prev: SavedVariant[]) => SavedVariant[]),
) => void

/** The scope-aware props the GuideEditor consumes. */
export interface GuideEditorProps {
  summary: string
  onSummaryChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  scopes: { id: string; label: string; hasContent: boolean }[]
  activeScope: GuideScope
  onScopeChange: (scope: GuideScope) => void
}

export interface GuideState {
  /** Build-wide guide — persisted to buildData on save / autosave and mirrored
   *  into the shared editor cache. (Per-variant guides live in `variants[i]`.) */
  buildSummary: string
  buildDescription: string
  /** Ready-made GuideEditor props, scoped to the build or the active variant. */
  editorProps: GuideEditorProps
}

/**
 * Owns the build editor's guide state: the build-wide summary/description, the
 * edit scope (build-wide vs a specific variant), and the scope-aware read/write
 * dispatch the GuideEditor needs. Per-variant guides live in `variants[i]` and
 * are written through `setVariants`; the build-wide guide is local state,
 * surfaced via `buildSummary`/`buildDescription` for the save / autosave /
 * shared-cache paths.
 *
 * Scope resets to "build" on mount: EditorShell remounts on a variant switch,
 * so switching variants never silently changes which guide you're editing.
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

  const scopes = variants.map((v) => ({
    id: v.id,
    label: v.label,
    hasContent: Boolean(
      (v.guideSummary && v.guideSummary.trim()) ||
      (v.guideDescription && v.guideDescription.trim()),
    ),
  }))

  return {
    buildSummary,
    buildDescription,
    editorProps: {
      summary,
      onSummaryChange,
      description,
      onDescriptionChange,
      scopes,
      activeScope: scope,
      onScopeChange: setScope,
    },
  }
}
