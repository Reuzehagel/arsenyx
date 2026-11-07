import { resolveBuildImage } from "@arsenyx/shared/seo/build-meta"
import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import { slugify } from "@arsenyx/shared/warframe/slugs"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"

import { BuildNotFound, BuildViewerBody } from "@/components/build-viewer"
import { buildQuery, catalogQueriesFor } from "@/lib/queries/build-query"
import { imageMapQuery } from "@/lib/queries/image-map-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import {
  partnerBuildsQuery,
  seedPartnersFromBuild,
} from "@/lib/queries/partner-builds-query"
import { buildPageSeo, seo } from "@/lib/seo"
import { parseVariantIndex } from "@/lib/util/search-params"

// `?embed=1` never reaches this route: the Worker (and the dev server, see
// vite.config.ts) serve embed.html for it.
export const Route = createFileRoute("/_app/builds/$slug")({
  validateSearch: (s: Record<string, unknown>): { v?: number } => {
    const v = parseVariantIndex(s.v)
    return v === undefined ? {} : { v }
  },
  loader: async ({ context, params }) => {
    const qc = context.queryClient
    const build = await qc.ensureQueryData(buildQuery(params.slug))
    // Warm what BuildViewerBodyInner suspends on so the loadout paints complete
    // instead of swapping a "Loading item…" placeholder for the full grid — the
    // shift that drove the build pages' CLS into the red. prefetchQuery is
    // best-effort (never throws), so a miss just falls back to the body's own
    // useSuspenseQuery rather than breaking navigation.
    if (isValidCategory(build.item.category)) {
      const itemSlug = slugify(build.item.name)
      // Gate the transition only on the small static files the loadout needs,
      // plus the related-builds strip. The strip uses a plain useQuery with no
      // height reservation, so warming it here lets it paint at its final
      // height instead of shoving the guide + footer down after commit. The
      // detail payload already carries the strip, so seed it from there
      // instead of a second API request; fetch only when it's absent.
      const seedPartners = seedPartnersFromBuild(qc, params.slug, build)
      await Promise.all([
        qc.prefetchQuery(itemQuery(build.item.category, itemSlug)),
        qc.prefetchQuery(imageMapQuery),
        qc.prefetchQuery(modConflictsQuery),
        ...(seedPartners
          ? []
          : [qc.prefetchQuery(partnerBuildsQuery(params.slug))]),
      ])
      // Legacy-shape builds rebuild their mods from the full mod/arcane/
      // helminth catalogs (~1.35MB). Warm them but don't gate navigation on the
      // download — the height-reserving BuildViewerFallback absorbs the CLS
      // while BuildViewerBodyWithCatalog's own useSuspenseQuery streams them in.
      const catalogs = catalogQueriesFor(build.buildData)
      if (catalogs) {
        const [mods, arcanes, helminth] = catalogs
        void qc.prefetchQuery(mods)
        void qc.prefetchQuery(arcanes)
        void qc.prefetchQuery(helminth)
      }
    }
    const ogImage = resolveBuildImage(
      build,
      qc.getQueryData(imageMapQuery.queryKey),
    )
    return { build, ogImage }
  },
  head: ({ loaderData, params }) =>
    loaderData
      ? buildPageSeo(loaderData.build, params.slug, loaderData.ogImage)
      : seo(),
  component: BuildPage,
  notFoundComponent: BuildNotFound,
})

function BuildPage() {
  return (
    <div className="wrap py-4 md:py-6">
      <Suspense fallback={<BuildViewerFallback />}>
        <BuildViewer />
      </Suspense>
    </div>
  )
}

// Reserves roughly a viewport of height while the viewer (or its data) is
// pending so the footer stays parked below the fold instead of jumping up to
// meet a one-line placeholder and then back down — the layout-shift the build
// pages were being dinged for. After the loader's prefetch this rarely shows on
// a cold load, but it still guards slow connections and client-side variant
// re-suspends.
function BuildViewerFallback() {
  return (
    <div className="flex min-h-[70vh] items-start justify-center pt-16">
      <p className="text-muted-foreground">Loading build…</p>
    </div>
  )
}

function BuildViewer() {
  const { slug } = Route.useParams()
  const { v } = Route.useSearch()
  const { data: build } = useSuspenseQuery(buildQuery(slug))
  const navigate = useNavigate()

  if (!isValidCategory(build.item.category)) {
    return <p className="text-muted-foreground">Unsupported category.</p>
  }

  // Persist the active variant in the URL (`?v=`) so a shared/bookmarked link
  // reopens on the same variant. The embed entry keeps it in local state.
  const onSelectVariant = (i: number) =>
    navigate({
      to: ".",
      params: true,
      search: (s) => (i === 0 ? { ...s, v: undefined } : { ...s, v: i }),
      // Keep history state (e.g. `buildFrom`, the related-builds back link).
      state: true,
      replace: true,
    })

  return (
    <Suspense fallback={<BuildViewerFallback />}>
      <BuildViewerBody
        key={slug}
        build={build}
        category={build.item.category}
        itemSlug={slugify(build.item.name)}
        embed={false}
        activeIndex={v}
        onSelectVariant={onSelectVariant}
      />
    </Suspense>
  )
}
