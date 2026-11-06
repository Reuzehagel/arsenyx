import { decodeBuildDoc } from "@arsenyx/shared/warframe/build-codec"
import { clampVariantIndex } from "@arsenyx/shared/warframe/build-doc"
import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Suspense, useReducer } from "react"

import { EditorShell, type EditorShellSearch } from "@/components/build-editor"
import { editorStoreKey } from "@/lib/drafts"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { buildQuery } from "@/lib/queries/build-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { incarnonAdapterImagesQuery } from "@/lib/queries/incarnon-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modsQuery } from "@/lib/queries/mods-query"
import { pageSeo } from "@/lib/seo"
import { parseVariantIndex } from "@/lib/util/search-params"

// Decode a share link far enough to learn which variant it was generated on.
// Pure + synchronous, so it's safe inside validateSearch. Returns undefined
// for the default (variant 0) so the `v` search param stays absent.
function activeVariantFromShare(share: string): number | undefined {
  const doc = decodeBuildDoc(share)
  if (!doc) return undefined
  const idx = clampVariantIndex(doc, doc.activeIndex ?? 0)
  return idx > 0 ? idx : undefined
}

export const Route = createFileRoute("/_app/create")({
  // The editor is a tool, not content — keep its parameterised URLs out of
  // the index so crawl budget goes to item and build pages.
  head: () => pageSeo("/create"),
  validateSearch: (search: Record<string, unknown>): EditorShellSearch => {
    const item = typeof search.item === "string" ? search.item : ""
    const category =
      typeof search.category === "string" && isValidCategory(search.category)
        ? search.category
        : "warframes"
    const build = typeof search.build === "string" ? search.build : undefined
    const draft = typeof search.draft === "string" ? search.draft : undefined
    const share = typeof search.share === "string" ? search.share : undefined
    // An explicit `?v` always wins. Otherwise, when opening a share link, seed
    // the active variant from the index the link was generated on (v2 `ai`),
    // so a multi-variant build opens on the variant the sharer was viewing.
    const v =
      parseVariantIndex(search.v) ??
      (share ? activeVariantFromShare(share) : undefined)
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
      context.queryClient.ensureQueryData(incarnonAdapterImagesQuery),
      // Preloaded for every category, not just warframes: EditorShell reads it
      // through useSuspenseQuery unconditionally, so skipping it here only
      // moved the same 25 KB fetch into a render-time suspense waterfall.
      context.queryClient.ensureQueryData(helminthQuery),
    ]
    if (deps.build) {
      tasks.push(context.queryClient.ensureQueryData(buildQuery(deps.build)))
    }
    await Promise.all(tasks)
  },
  component: CreatePage,
})

function CreatePage() {
  const search = Route.useSearch()
  // One editor session per edited build (or new-build item): the key scopes
  // the editor's state, so navigating away or to another build starts fresh.
  // Reset-to-saved bumps `resets` for a fresh session from the saved build.
  const [resets, reseed] = useReducer((n: number) => n + 1, 0)
  const sessionKey = `${editorStoreKey(search.build, search.category, search.item)}#${resets}`
  return (
    <div className="wrap px-4 py-4 md:py-6">
      <Suspense
        fallback={<p className="text-muted-foreground">Loading item…</p>}
      >
        <EditorShell key={sessionKey} search={search} onResetToSaved={reseed} />
      </Suspense>
    </div>
  )
}
