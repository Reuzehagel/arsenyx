import { decodeBuildDoc } from "@arsenyx/shared/warframe/build-codec"
import {
  clampVariantIndex,
  MAX_VARIANT_PARSE_INDEX,
} from "@arsenyx/shared/warframe/build-doc"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Suspense, useEffect, useSyncExternalStore } from "react"

import {
  EditorShell,
  getVariantEpoch,
  resetEditorCache,
  subscribeVariantEpoch,
  type EditorShellSearch,
} from "@/components/build-editor"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { buildQuery } from "@/lib/queries/build-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modsQuery } from "@/lib/queries/mods-query"
import { isValidCategory, type BrowseCategory } from "@/lib/warframe"

// Decode a share link far enough to learn which variant it was generated on.
// Pure + synchronous, so it's safe inside validateSearch. Returns undefined
// for the default (variant 0) so the `v` search param stays absent.
function activeVariantFromShare(share: string): number | undefined {
  const doc = decodeBuildDoc(share)
  if (!doc) return undefined
  const idx = clampVariantIndex(doc, doc.activeIndex ?? 0)
  return idx > 0 ? idx : undefined
}

export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>): EditorShellSearch => {
    const item = typeof search.item === "string" ? search.item : ""
    const category =
      typeof search.category === "string" && isValidCategory(search.category)
        ? search.category
        : ("warframes" as BrowseCategory)
    const build = typeof search.build === "string" ? search.build : undefined
    const draft = typeof search.draft === "string" ? search.draft : undefined
    const share = typeof search.share === "string" ? search.share : undefined
    const rawV =
      typeof search.v === "string"
        ? Number(search.v)
        : typeof search.v === "number"
          ? search.v
          : undefined
    // An explicit `?v` always wins. Otherwise, when opening a share link, seed
    // the active variant from the index the link was generated on (v2 `ai`),
    // so a multi-variant build opens on the variant the sharer was viewing.
    const v =
      rawV !== undefined && Number.isFinite(rawV) && rawV >= 0
        ? Math.min(MAX_VARIANT_PARSE_INDEX, Math.floor(rawV))
        : share
          ? activeVariantFromShare(share)
          : undefined
    return {
      item,
      category,
      build,
      draft,
      share,
      ...(v !== undefined && { v }),
    }
  },
  beforeLoad: ({ search }) => {
    if (!search.item) {
      throw redirect({ to: "/browse", search: { category: "warframes" } })
    }
  },
  loaderDeps: ({ search }) => ({
    item: search.item,
    category: search.category,
    build: search.build,
  }),
  loader: async ({ context, deps }) => {
    const tasks: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(itemQuery(deps.category, deps.item)),
      context.queryClient.ensureQueryData(modsQuery),
      context.queryClient.ensureQueryData(arcanesQuery),
    ]
    if (deps.category === "warframes") {
      tasks.push(context.queryClient.ensureQueryData(helminthQuery))
    }
    if (deps.build) {
      tasks.push(context.queryClient.ensureQueryData(buildQuery(deps.build)))
    }
    await Promise.all(tasks)
  },
  component: CreatePage,
})

function CreatePage() {
  // Re-key EditorShell on variant switch so the per-variant hooks
  // (useBuildSlots / useArcaneSlots) re-initialize from the projected
  // variant's data. Cheaper than extracting + threading callbacks for
  // every per-variant setter through every subcomponent.
  const search = Route.useSearch()
  // `?v` is a variant *index*; deleting a non-last active variant leaves it
  // unchanged while the variant at that index changes. The epoch advances on
  // every structural variant mutation, so folding it into the key forces a
  // remount + re-hydration even when the index doesn't move.
  const variantEpoch = useSyncExternalStore(
    subscribeVariantEpoch,
    getVariantEpoch,
    getVariantEpoch,
  )
  const variantKey = `${search.build ?? "new"}-${search.v ?? 0}-${variantEpoch}`
  // Drop the in-memory editor cache on every navigation away from
  // /create (Cancel, route change). Without this, an unsaved variant
  // added before Cancel would silently re-appear next time the user
  // opened the same build's editor.
  useEffect(() => () => resetEditorCache(), [])
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap px-4 py-4 md:py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading item…</p>}
          >
            <EditorShell key={variantKey} search={search} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
