import type {
  SavedBuildData,
  SavedVariant,
  VariantMode,
} from "@arsenyx/shared/warframe/build-data"
import { clampVariantIndex } from "@arsenyx/shared/warframe/build-doc"
import { getIncarnonBaseName } from "@arsenyx/shared/warframe/incarnon-data"
import type { BrowseCategory } from "@arsenyx/shared/warframe/types"
import { useMemo, useState } from "react"

import {
  BUILD_WIDE_EXTRAS,
  type BuildWideExtras,
  type ExtrasState,
  extrasFromSaved,
  reconcileModularParts,
} from "@/lib/build/extras"
import { getBuildLayout } from "@/lib/build/layout"
import { loadoutFromSaved } from "@/lib/build/loadout"
import type { DetailItem } from "@/lib/catalog"
import {
  getVariants,
  isSyntheticVariant,
  linkVariants,
  projectSavedVariant,
  resolveVariantMode,
} from "@/lib/codec/build-codec-adapter"
import { withFormPolarities } from "@/lib/form-axis"
import { useFormAxis } from "@/lib/hooks/use-form-axis"

import { makeEditorCapture } from "./editor-capture"
import { useArcaneSlots } from "./use-arcane-slots"
import { useBuildSlots } from "./use-build-slots"
import { useDraftAutosave } from "./use-draft-autosave"
import { useEditorHydration } from "./use-editor-hydration"
import { useEditorUndo } from "./use-editor-undo"
import { useGuideState } from "./use-guide-state"
import { useVariantActions } from "./use-variant-actions"

export interface EditorShellSearch {
  item: string
  category: BrowseCategory
  build?: string
  draft?: string
  share?: string
  /** Active variant index for multi-variant builds. 0 (or undefined) =
   *  first variant. */
  v?: number
}

/** The editor's starting variants. A fresh twin-frame build (Sirius & Orion)
 *  gets one variant per form so both forms are switchable from the start;
 *  saved/shared builds already carry their own. */
function seedVariants(
  savedDataAll: SavedBuildData,
  item: DetailItem,
): SavedVariant[] {
  const initial = getVariants(savedDataAll)
  const forms = item.forms
  if (
    !forms ||
    forms.length < 2 ||
    initial.length !== 1 ||
    !isSyntheticVariant(initial[0])
  ) {
    return initial
  }
  // Each form's first variant keeps the synthetic "Main" label — the form name
  // lives on the form toggle. Distinct ids so they don't collide.
  return forms.map((_form, i) => ({
    ...initial[0],
    id: i === 0 ? initial[0].id : `form${i}`,
    formIndex: i,
  }))
}

export type EditorStore = ReturnType<typeof useEditorStore>

/**
 * The build editor's state for one editing session: hydration, the variants
 * array, the active variant's live slots/arcanes/extras, build-wide fields
 * (name, guide, forma, reactor & co.), undo and draft autosave.
 *
 * Lives as long as the component that calls it — the create route keys that
 * on the build being edited, so nothing outlives a navigation. A variant
 * switch is a state transition (`activate`): the active variant is folded back
 * into `variants` and the target's slice re-seeds the live hooks.
 *
 * `onActivate` reports every variant switch (the shell mirrors it into the
 * URL); `onResetToSaved` re-creates the session after the draft is dropped.
 */
export function useEditorStore({
  search,
  onResetToSaved,
  onActivate,
  onAdopted,
}: {
  search: EditorShellSearch
  onResetToSaved: () => void
  /** A share link or import was written as this item's draft; drop
   *  `share`/`draft` from the URL so a refresh restores that draft. */
  onAdopted?: () => void
  /** Called on every variant switch with the new active index, for UI state
   *  the store doesn't own. */
  onActivate?: (index: number) => void
}) {
  const {
    item: slug,
    category,
    build: buildSlug,
    draft: draftId,
    share: shareEncoded,
    v = 0,
  } = search
  const hydration = useEditorHydration({
    slug,
    category,
    buildSlug,
    draftId,
    shareEncoded,
  })
  const {
    item,
    existingBuild,
    allMods,
    allArcanes,
    incarnonAdapterImages,
    conflictMap,
    draft,
    storeKey,
    localDraft,
    adoption,
    savedDataAll,
    shareBuildName,
  } = hydration

  const [variants, setVariants] = useState(() =>
    seedVariants(savedDataAll, item),
  )
  const [activeIndex, setActiveIndex] = useState(v)
  const [variantMode, setVariantMode] = useState<VariantMode>(() =>
    resolveVariantMode(savedDataAll),
  )
  const clampedActiveIndex = clampVariantIndex({ variants }, activeIndex)

  // Read live from `variants` so changing a variant's form updates the
  // ability strip and tabs immediately.
  const { effectiveItem, ...formAxis } = useFormAxis(
    item,
    variants,
    clampedActiveIndex,
  )
  const layout = useMemo(
    () => getBuildLayout(effectiveItem, category),
    [effectiveItem, category],
  )

  const [initial] = useState(() => {
    const savedData = projectSavedVariant(
      savedDataAll,
      variants[clampedActiveIndex],
    )
    return {
      loadout: loadoutFromSaved(savedData, item, category, layout),
      extras: extrasFromSaved(savedData, item, category),
    }
  })
  const slots = useBuildSlots(layout, initial.loadout, conflictMap)
  const arcanes = useArcaneSlots(initial.loadout.arcanes)
  const [extras, setExtras] = useState<ExtrasState>(initial.extras)
  const incarnonBaseName = getIncarnonBaseName(item.name)
  const displayImageName =
    (extras.incarnonEnabled && incarnonBaseName
      ? incarnonAdapterImages[incarnonBaseName]
      : undefined) ??
    item.imageName ??
    undefined

  const [buildName, setBuildName] = useState(
    () =>
      localDraft?.buildName ??
      existingBuild?.name ??
      draft?.buildName ??
      shareBuildName ??
      item.name,
  )
  const guide = useGuideState({
    initialSummary:
      localDraft?.guideSummary ?? existingBuild?.guide?.summary ?? "",
    initialDescription:
      localDraft?.guideDescription ??
      existingBuild?.guide?.description ??
      draft?.guideDescription ??
      "",
    variants,
    setVariants,
  })

  const history = useEditorUndo({ slots, arcanes, extras, setExtras })

  /** Make `next[index]` the active variant. `next` must already hold the
   *  outgoing variant's live edits (see `captureVariants`). The target's own
   *  forma loads (per-variant; linked copies are already equal); the build-wide
   *  extras carry over; history and the slot selection restart. */
  const activate = (next: SavedVariant[], index: number) => {
    const savedData = projectSavedVariant(savedDataAll, next[index])
    // Fitted to the target's form: a twin-frame form switch changes the layout.
    const targetLayout = getBuildLayout(
      withFormPolarities(item, next[index].formIndex ?? 0),
      category,
    )
    const loadout = loadoutFromSaved(savedData, item, category, targetLayout)
    const buildWide = Object.fromEntries(
      BUILD_WIDE_EXTRAS.map((k) => [k, extras[k]]),
    ) as BuildWideExtras
    const nextExtras = reconcileModularParts(
      { ...extrasFromSaved(savedData, item, category), ...buildWide },
      item,
      category,
    )
    guide.followVariants(next)
    setVariants(next)
    setActiveIndex(index)
    slots.setPlaced(loadout.placed)
    slots.setFormaPolarities(loadout.formaPolarities)
    slots.setSelected("normal-0")
    arcanes.setPlaced(loadout.arcanes)
    arcanes.setSelected(null)
    setExtras(nextExtras)
    history.reset({
      placed: loadout.placed,
      formaPolarities: loadout.formaPolarities,
      arcanes: loadout.arcanes,
      extras: nextExtras,
    })
    onActivate?.(index)
  }

  const isUpdate = !!existingBuild && existingBuild.isOwner

  const capture = makeEditorCapture({
    variantMode,
    variants,
    clampedActiveIndex,
    slots,
    arcanes,
    extras,
    buildDescription: guide.buildDescription,
    allMods,
    allArcanes,
  })

  const { hasDraft, resetToSaved } = useDraftAutosave({
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
    variantMode,
    onResetToSaved,
    adoption,
    onAdopted,
  })

  const variantActions = useVariantActions({
    variants,
    setVariants,
    clampedActiveIndex,
    captureVariants: capture.captureVariants,
    activate,
    activeFormIndex: formAxis.activeFormIndex,
    variantMode,
  })

  /** Switch the build's Variant mode. Linking copies the active variant's
   *  shards (and its form's forma) onto the others. */
  const applyVariantMode = (next: VariantMode) => {
    if (next === "linked")
      setVariants(linkVariants(capture.captureVariants(), clampedActiveIndex))
    setVariantMode(next)
  }

  return {
    item,
    category,
    slug,
    buildSlug,
    existingBuild,
    allMods,
    allArcanes,
    conflictMap,
    storeKey,
    isUpdate,
    variants,
    setVariants,
    clampedActiveIndex,
    formAxis,
    effectiveItem,
    layout,
    slots,
    arcanes,
    extras,
    setExtras,
    displayImageName,
    buildName,
    setBuildName,
    guide,
    history,
    capture,
    hasDraft,
    resetToSaved,
    variantActions,
    variantMode,
    applyVariantMode,
  }
}
