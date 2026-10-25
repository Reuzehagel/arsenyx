import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"

import {
  isSyntheticVariant,
  pickPerVariantData,
  stripPersistedImages,
  SYNTHETIC_VARIANT_ID,
  SYNTHETIC_VARIANT_LABEL,
} from "@/lib/codec/build-codec-adapter"
import { collectGuideRefs } from "@/lib/guide-refs"
import type { SavedBuildData, SavedVariant } from "@/lib/queries/build-query"

import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState } from "./use-build-slots"
import type { ItemExtras } from "./use-item-extras"

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
}: {
  variants: SavedVariant[]
  clampedActiveIndex: number
  slots: BuildSlotsState
  arcanes: ArcaneSlotsState
  extras: ItemExtras
  buildDescription: string
  allMods: Mod[]
  allArcanes: Arcane[]
}) {
  // Switching captures the in-progress edits into `variants` and updates
  // the URL ?v=N — the remount on the new key reinitializes hooks from
  // the new variant's data. Unsaved per-variant edits live in `variants`
  // until the next save.
  const captureActiveSnapshot = (): SavedVariant => {
    const existing = variants[clampedActiveIndex]
    return {
      id: existing?.id ?? SYNTHETIC_VARIANT_ID,
      label: existing?.label ?? SYNTHETIC_VARIANT_LABEL,
      slots: slots.placed,
      arcanes: arcanes.placed,
      // Shards are per-variant — capture the live set into this variant.
      shards: extras.shards,
      ...pickPerVariantData({
        helminth: extras.helminth,
        incarnonEnabled: extras.incarnonEnabled,
        incarnonPerks: extras.incarnonPerks,
        deploymentContext: extras.deploymentContext,
        // formIndex is a variant property (set via the form selector), not
        // live editor state — preserve it from the existing variant.
        formIndex: existing?.formIndex,
      }),
      // Per-variant guide fields are owned by `variants[i]` directly
      // (GuideEditor writes through setVariants). Preserve them on
      // snapshot so a save while editing build-wide doesn't wipe them.
      guideSummary: existing?.guideSummary,
      guideDescription: existing?.guideDescription,
    }
  }

  // The full persistable buildData for the current editor state, with the
  // active variant's live edits folded back into the variants array.
  const captureBuildData = (): SavedBuildData => {
    const activeSnapshot = captureActiveSnapshot()
    const nextVariants = variants.map((v, i) =>
      i === clampedActiveIndex ? activeSnapshot : v,
    )
    // Snapshot every mod/arcane referenced from guide text (build-wide +
    // per-variant) so the viewer renders hover cards without the catalog —
    // see lib/guide-refs.ts.
    const guideRefs = collectGuideRefs(
      [buildDescription, ...nextVariants.map((v) => v.guideDescription)],
      allMods,
      allArcanes,
    )
    return stripPersistedImages({
      version: 1,
      slots: slots.placed,
      formaPolarities: slots.formaPolarities,
      arcanes: arcanes.placed,
      // Top-level `shards` mirrors the active variant (per-variant sets live in
      // `variants[i].shards`). Legacy `formShards` is intentionally not emitted.
      shards: extras.shards,
      hasReactor: extras.hasReactor,
      helminth: extras.helminth,
      zawComponents: extras.zawComponents,
      kitgunComponents: extras.kitgunComponents,
      lichBonusElement: extras.lichBonusElement ?? undefined,
      incarnonEnabled: extras.incarnonEnabled,
      incarnonPerks: extras.incarnonPerks,
      deploymentContext: extras.deploymentContext,
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

  return { captureActiveSnapshot, captureBuildData }
}
