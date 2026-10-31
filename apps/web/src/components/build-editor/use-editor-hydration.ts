import { decodeBuildDoc } from "@arsenyx/shared/warframe/build-codec"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import {
  normalizeBuildData,
  savedDataFromBuildDoc,
} from "@/lib/codec/build-codec-adapter"
import { loadEditorDraft, type EditorDraftPayload } from "@/lib/editor-draft"
import { consumeDraft } from "@/lib/import-draft"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { buildQuery, type SavedBuildData } from "@/lib/queries/build-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { incarnonAdapterImagesQuery } from "@/lib/queries/incarnon-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"
import type { BrowseCategory } from "@/lib/warframe"

import { editorCache } from "./editor-cache"

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

/**
 * Loads the catalog + the build being edited, and decides what the editor
 * starts from: an import draft, an autosaved local draft, the saved build, a
 * share link, or blank. Everything here is read once per mount.
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
  const { data: existingBuild } = useQuery({
    ...buildQuery(buildSlug ?? ""),
    enabled: !!buildSlug,
  })
  const { data: allMods } = useSuspenseQuery(modsQuery)
  const { data: allArcanes } = useSuspenseQuery(arcanesQuery)
  const { data: helminthAbilities } = useSuspenseQuery(helminthQuery)
  const { data: incarnonAdapterImages } = useSuspenseQuery(
    incarnonAdapterImagesQuery,
  )
  const { data: conflictMap } = useSuspenseQuery(modConflictsQuery)
  const [draft] = useState(() => consumeDraft(draftId))
  const [shareHydrated] = useState(() => {
    if (!shareEncoded) return null
    // decodeBuildDoc handles both v1 (wrapped as single-variant doc) and v2;
    // savedDataFromBuildDoc owns the BuildDoc→editor projection (and the
    // per-variant/shared split) so it can't drift from the encode side.
    const doc = decodeBuildDoc(shareEncoded)
    return doc
      ? { data: savedDataFromBuildDoc(doc, allMods, allArcanes) }
      : null
  })
  // Identity for the in-memory cache and the localStorage draft bucket.
  // `buildSlug` for an existing build; item+category for a new one (the
  // EditorShell isn't re-keyed on item change, but the lookup must still
  // distinguish two consecutive new-build sessions on different items).
  const storeKey = buildSlug ?? `__new_build__:${category}:${slug}`

  // Whether a draft exists on disk for this build, read once at mount. Null
  // when a share link or import is driving hydration — we don't surface a
  // stale draft as "active" in that case.
  const [storedDraft] = useState<EditorDraftPayload | null>(() =>
    shareEncoded || draftId ? null : loadEditorDraft(storeKey),
  )
  // Hydrate the editor from the draft only on a *fresh* mount. A variant-switch
  // remount keeps the in-memory cache, so re-applying the draft (and re-firing
  // the restore toast) would be wrong — but the draft still exists on disk, so
  // `storedDraft` stays non-null to keep the badge visible.
  const [localDraft] = useState<EditorDraftPayload | null>(() =>
    editorCache.current && editorCache.current.key === storeKey
      ? null
      : storedDraft,
  )

  // Full normalized saved data (all variants intact); used when persisting.
  const savedDataAll: SavedBuildData = useMemo(
    () =>
      resolveSavedDataAll(
        {
          importDraft: draft?.data ?? null,
          localDraft: localDraft ? { raw: localDraft.buildData } : null,
          savedBuild: existingBuild ? { raw: existingBuild.buildData } : null,
          share: shareHydrated?.data ?? null,
        },
        (data) =>
          normalizeBuildData(data, allMods, allArcanes, helminthAbilities),
      ),
    [
      draft,
      localDraft,
      existingBuild,
      shareHydrated,
      allMods,
      allArcanes,
      helminthAbilities,
    ],
  )

  return {
    item,
    existingBuild,
    allMods,
    allArcanes,
    incarnonAdapterImages,
    conflictMap,
    draft,
    storeKey,
    storedDraft,
    localDraft,
    savedDataAll,
  }
}
