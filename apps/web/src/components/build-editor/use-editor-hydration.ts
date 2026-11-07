import { decodeBuildDoc } from "@arsenyx/shared/warframe/build-codec"
import type { SavedBuildData } from "@arsenyx/shared/warframe/build-data"
import type {
  Arcane,
  BrowseCategory,
  Mod,
} from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useState } from "react"

import {
  loadBuildData,
  savedDataFromBuildDoc,
} from "@/lib/codec/build-codec-adapter"
import {
  editorStoreKey,
  loadEditorDraft,
  loadImportDraft,
  type EditorDraftPayload,
} from "@/lib/drafts"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { editedBuildQuery } from "@/lib/queries/build-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { incarnonAdapterImagesQuery } from "@/lib/queries/incarnon-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"

/** Which source seeds a fresh editor, in priority order. Pure so the order is
 *  testable; `normalize` re-resolves catalog images for persisted data. */
export function resolveSavedDataAll(
  sources: {
    importDraft: SavedBuildData | null
    // Wrapped so presence (not the payload's truthiness) decides precedence.
    localDraft: { raw: unknown } | null
    savedBuild: { raw: unknown } | null
    share: SavedBuildData | null
  },
  normalize: (raw: unknown) => SavedBuildData,
): SavedBuildData {
  if (sources.importDraft) return sources.importDraft
  // A restored draft overrides the saved build — that's the whole point.
  // The "Draft restored" toast + reset control keep it from being haunted.
  // Normalize like a saved build: the draft persisted with mod/arcane
  // `imageName` stripped (see stripPersistedImages), so re-resolve images
  // from the catalog — otherwise restored mods render with a blank "?" tile.
  if (sources.localDraft) return normalize(sources.localDraft.raw)
  if (sources.savedBuild) return normalize(sources.savedBuild.raw)
  if (sources.share) return sources.share
  return {} as SavedBuildData
}

/** A share link's editor data and the build name it carries, or null when it
 *  doesn't decode. decodeBuildDoc handles both v1 (wrapped as single-variant
 *  doc) and v2; savedDataFromBuildDoc owns the BuildDoc→editor projection (and
 *  the per-variant/shared split) so it can't drift from the encode side. */
export function hydrateShare(
  encoded: string,
  mods: Mod[],
  arcanes: Arcane[],
): { data: SavedBuildData; buildName: string | undefined } | null {
  const doc = decodeBuildDoc(encoded)
  return doc
    ? {
        data: savedDataFromBuildDoc(doc, mods, arcanes),
        buildName: doc.buildName,
      }
    : null
}

/**
 * Loads the catalog + the build being edited, and decides what the editor
 * starts from: an import draft, an autosaved local draft, the saved build, a
 * share link, or blank. Everything here is read once per editor session.
 */
export function useEditorHydration({
  slug,
  category,
  buildSlug,
  draftId,
  shareEncoded,
}: {
  slug: string
  category: BrowseCategory
  buildSlug?: string
  draftId?: string
  shareEncoded?: string
}) {
  const { data: item } = useSuspenseQuery(itemQuery(category, slug))
  // Suspends like the catalog reads; a new build resolves to null at once.
  const { data: existingBuild } = useSuspenseQuery(editedBuildQuery(buildSlug))
  const { data: allMods } = useSuspenseQuery(modsQuery)
  const { data: allArcanes } = useSuspenseQuery(arcanesQuery)
  const { data: helminthAbilities } = useSuspenseQuery(helminthQuery)
  const { data: incarnonAdapterImages } = useSuspenseQuery(
    incarnonAdapterImagesQuery,
  )
  const { data: conflictMap } = useSuspenseQuery(modConflictsQuery)
  const [draft] = useState(() => loadImportDraft(draftId))
  const [shareHydrated] = useState(() =>
    shareEncoded ? hydrateShare(shareEncoded, allMods, allArcanes) : null,
  )
  const storeKey = editorStoreKey(buildSlug, category, slug)

  // A share link or import that resolved drives hydration and is then adopted
  // as this item's draft (see useDraftAutosave), replacing any autosaved one —
  // kept in `adoption.replaced` so the user can restore it.
  const adopting = !!(draft || shareHydrated)
  const [localDraft] = useState<EditorDraftPayload | null>(() =>
    adopting ? null : loadEditorDraft(storeKey),
  )
  const [adoption] = useState(() =>
    adopting
      ? {
          replaced: loadEditorDraft(storeKey),
          importId: draft ? draftId : undefined,
        }
      : null,
  )

  // Full normalized saved data (all variants intact); used when persisting.
  // Read once: a background refetch of the saved build must not change what a
  // variant switch seeds from mid-session.
  const [savedDataAll] = useState(() =>
    resolveSavedDataAll(
      {
        importDraft: draft?.data ?? null,
        localDraft: localDraft ? { raw: localDraft.buildData } : null,
        savedBuild: existingBuild ? { raw: existingBuild.buildData } : null,
        share: shareHydrated?.data ?? null,
      },
      (data) =>
        loadBuildData(data, {
          mods: allMods,
          arcanes: allArcanes,
          helminth: helminthAbilities,
        }),
    ),
  )

  return {
    item,
    existingBuild: existingBuild ?? undefined,
    allMods,
    allArcanes,
    incarnonAdapterImages,
    conflictMap,
    draft,
    storeKey,
    localDraft,
    adoption,
    savedDataAll,
    shareBuildName: shareHydrated?.buildName,
  }
}
