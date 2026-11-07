import {
  pickPerVariantData,
  type SavedBuildData,
  type SavedVariant,
  type VariantMode,
} from "@arsenyx/shared/warframe/build-data"
import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"

import { type ExtrasState, extrasToSaved } from "@/lib/build/extras"
import { foldedVariants } from "@/lib/build/variants"
import {
  isSyntheticVariant,
  linkVariants,
  stripPersistedImages,
  SYNTHETIC_VARIANT_ID,
  SYNTHETIC_VARIANT_LABEL,
} from "@/lib/codec/build-codec-adapter"
import { collectGuideRefs } from "@/lib/guide-refs"

import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState } from "./use-build-slots"

export type EditorCapture = ReturnType<typeof makeEditorCapture>

/** Readers that fold the live editor state back into persistable shapes.
 *  Shared by save, share, autosave and variant switching so they can't drift. */
export function makeEditorCapture({
  variants,
  clampedActiveIndex,
  slots,
  arcanes,
  extras,
  buildDescription,
  allMods,
  allArcanes,
  variantMode,
}: {
  variantMode: VariantMode
  variants: SavedVariant[]
  clampedActiveIndex: number
  slots: Pick<BuildSlotsState, "placed" | "formaPolarities">
  arcanes: Pick<ArcaneSlotsState, "placed">
  extras: ExtrasState
  buildDescription: string
  allMods: Mod[]
  allArcanes: Arcane[]
}) {
  /** The active variant's live loadout + extras, in persisted shape. */
  const captureLive = () => ({
    ...extrasToSaved(extras),
    slots: slots.placed,
    formaPolarities: slots.formaPolarities,
    arcanes: arcanes.placed,
  })

  const captureActiveSnapshot = (): SavedVariant => {
    const existing = variants[clampedActiveIndex]
    const live = captureLive()
    return {
      id: existing?.id ?? SYNTHETIC_VARIANT_ID,
      label: existing?.label ?? SYNTHETIC_VARIANT_LABEL,
      slots: live.slots,
      arcanes: live.arcanes,
      // Shards and forma are stored per-variant: capture the live sets.
      shards: live.shards,
      formaPolarities: live.formaPolarities,
      // formIndex is set by the form selector, not live editor state.
      ...pickPerVariantData({ ...live, formIndex: existing?.formIndex }),
      // Per-variant guides are written straight into `variants[i]` by the
      // guide editor; keep them so a save while editing build-wide doesn't
      // wipe them.
      guideSummary: existing?.guideSummary,
      guideDescription: existing?.guideDescription,
    }
  }

  /** Every variant, the active one replaced by its live snapshot. In linked
   *  mode the active variant's shards (and its form's forma) are copied onto
   *  the others. */
  const captureVariants = () => {
    const merged = foldedVariants(
      variants,
      clampedActiveIndex,
      captureActiveSnapshot(),
    )
    return variantMode === "linked"
      ? linkVariants(merged, clampedActiveIndex)
      : merged
  }

  // Every value read here must also be in useDraftAutosave's `deps`, or
  // editing it alone never writes a draft.
  const captureBuildData = (): SavedBuildData => {
    const nextVariants = captureVariants()
    // Snapshot every mod/arcane referenced from guide text so the viewer
    // renders hover cards without the catalog — see lib/guide-refs.ts.
    const guideRefs = collectGuideRefs(
      [buildDescription, ...nextVariants.map((v) => v.guideDescription)],
      allMods,
      allArcanes,
    )
    return stripPersistedImages({
      version: 1,
      variantMode,
      // Top-level fields mirror the active variant for legacy readers.
      ...captureLive(),
      formIndex: variants[clampedActiveIndex]?.formIndex,
      guideRefs,
      // Emit `variants` whenever there's more than one OR the single
      // remaining variant has a user-assigned label/id — otherwise the
      // synthetic placeholder from getVariants() would silently overwrite
      // the user's label after delete-down-to-one.
      ...((nextVariants.length > 1 || !isSyntheticVariant(nextVariants[0])) && {
        variants: nextVariants,
      }),
    })
  }

  return {
    captureLive,
    captureActiveSnapshot,
    captureVariants,
    captureBuildData,
  }
}
