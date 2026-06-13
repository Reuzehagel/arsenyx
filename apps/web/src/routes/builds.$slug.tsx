import { buildMetaTitle, buildOgType } from "@arsenyx/shared/seo/build-meta"
import { slugify } from "@arsenyx/shared/warframe/slugs"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"

import {
  BuildNotFound,
  BuildViewerBody,
  EmbedShell,
} from "@/components/build-viewer"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { isLegacyBuildData } from "@/lib/codec/build-codec-adapter"
import { clampEmbedParams } from "@/lib/embed-params"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { buildQuery, type BuildDetail } from "@/lib/queries/build-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { imageMapQuery } from "@/lib/queries/image-map-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"
import { seo } from "@/lib/seo"
import {
  type BrowseCategory,
  type DetailItem,
  isValidCategory,
} from "@/lib/warframe"

interface BuildSearch {
  /** When true, render a chrome-less view suitable for embedding. */
  embed?: boolean
  /** CSS zoom multiplier applied to the whole embed (e.g. 0.9 = 90%).
   *  Shrinks everything uniformly while wrap-query reflow still works
   *  (mods wrap at narrow widths). */
  scale?: number
  /** Optional background colour (CSS value without #, e.g. `22272e`).
   *  Applied to the iframe body so the embed blends with the host page. */
  bg?: string
  /** Active variant index for multi-variant builds. Clamped to a valid
   *  index by the viewer; omitted (default 0) for single-variant builds. */
  v?: number
}

export const Route = createFileRoute("/builds/$slug")({
  validateSearch: (s: Record<string, unknown>): BuildSearch => {
    const embed = s.embed === true || s.embed === "1" || s.embed === "true"
    const num = (v: unknown) => {
      const n = typeof v === "string" ? Number(v) : v
      return typeof n === "number" && Number.isFinite(n) ? n : undefined
    }
    // Bounds logic is shared with the embed entry's parseParams — see
    // clampEmbedParams. Coerce the router's `unknown` values first, then clamp.
    const { scale, bg, v } = clampEmbedParams({
      scale: num(s.scale),
      bg: typeof s.bg === "string" ? s.bg : undefined,
      v: num(s.v),
    })
    return {
      ...(embed && { embed }),
      ...(scale !== undefined && { scale }),
      ...(bg !== undefined && { bg }),
      ...(v !== undefined && { v }),
    }
  },
  loader: async ({ context, params }) => {
    const qc = context.queryClient
    const build = await qc.ensureQueryData(buildQuery(params.slug))
    // The build's stored item.imageName is denormalized and rots across
    // image-scheme changes, so it's only a fallback for the OG card; the live
    // catalog item's imageName (resolved below) is preferred. Mirrors the
    // Worker's buildMeta so the server- and client-rendered og:image agree.
    let ogImageName = build.item.imageName ?? null
    // Warm what BuildViewerBodyInner suspends on so the loadout paints complete
    // instead of swapping a "Loading item…" placeholder for the full grid — the
    // shift that drove the build pages' CLS into the red. prefetchQuery is
    // best-effort (never throws), so a miss just falls back to the body's own
    // useSuspenseQuery rather than breaking navigation.
    if (isValidCategory(build.item.category)) {
      const category = build.item.category as BrowseCategory
      const itemSlug = slugify(build.item.name)
      // Gate the transition only on the small static files the loadout needs.
      await Promise.all([
        qc.prefetchQuery(itemQuery(category, itemSlug)),
        qc.prefetchQuery(imageMapQuery),
        qc.prefetchQuery(modConflictsQuery),
      ])
      // Prefer the freshly-warmed catalog item's image over the build's stale
      // copy (same source the SPA header uses — see viewer-header.tsx).
      ogImageName =
        qc.getQueryData<DetailItem>(itemQuery(category, itemSlug).queryKey)
          ?.imageName ?? ogImageName
      // Legacy-shape builds rebuild their mods from the full mod/arcane/
      // helminth catalogs (~1.35MB). Warm them but don't gate navigation on the
      // download — the height-reserving BuildViewerFallback absorbs the CLS
      // while BuildViewerBodyWithCatalog's own useSuspenseQuery streams them in.
      if (isLegacyBuildData(build.buildData)) {
        void qc.prefetchQuery(arcanesQuery)
        void qc.prefetchQuery(modsQuery)
        void qc.prefetchQuery(helminthQuery)
      }
    }
    return { build, ogImage: ogImageName }
  },
  // Title / canonical / og:image / og:type mirror what the Worker injects for
  // crawlers (worker/index.ts buildMeta); title and og:type are single-sourced
  // via @arsenyx/shared/seo/build-meta, so they can't drift. og:description
  // DELIBERATELY differs: the edge layer enriches it with live like/view stats
  // for unfurls (the only consumer that reads server-injected meta), while this
  // client copy — seen only during in-app SPA navigation — stays lightweight.
  // Non-public builds are noindexed; the ?embed=1 duplicate resolves to the
  // clean URL via the canonical.
  head: ({ loaderData, params }) => {
    if (!loaderData) return seo()
    const { build, ogImage } = loaderData
    return seo({
      title: buildMetaTitle(build),
      description: buildDescription(build),
      canonicalPath: `/builds/${params.slug}`,
      // Raw catalog/build imageName — seo() absolutizes against the image CDN.
      image: ogImage ?? undefined,
      // Title/og:type come from @arsenyx/shared/seo/build-meta — the same
      // source the Worker uses (worker/index.ts buildMeta) — so the two head
      // layers can't disagree.
      ogType: buildOgType(build.visibility),
      noindex: build.visibility !== "PUBLIC",
    })
  },
  component: BuildPage,
  notFoundComponent: BuildNotFound,
})

function buildDescription(b: BuildDetail): string {
  const summary = (b.guide?.summary ?? b.description ?? "")
    .replace(/\s+/g, " ")
    .trim()
  const lead = b.name === b.item.name ? "" : `${b.name}. `
  const body = summary || `${b.item.name} build with mods, arcanes, and stats.`
  return `${lead}${body}`.slice(0, 280)
}

function BuildPage() {
  const { embed, scale, bg } = Route.useSearch()

  if (embed) {
    return (
      <EmbedShell scale={scale} bg={bg}>
        <Suspense
          fallback={<p className="text-muted-foreground">Loading build…</p>}
        >
          <BuildViewer embed />
        </Suspense>
      </EmbedShell>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap py-4 md:py-6">
          <Suspense fallback={<BuildViewerFallback />}>
            <BuildViewer />
          </Suspense>
        </div>
      </main>
      <Footer />
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

function BuildViewer({ embed = false }: { embed?: boolean }) {
  const { slug } = Route.useParams()
  const { v } = Route.useSearch()
  const { data: build } = useSuspenseQuery(buildQuery(slug))
  const navigate = useNavigate()

  if (!isValidCategory(build.item.category)) {
    return <p className="text-muted-foreground">Unsupported category.</p>
  }
  const category = build.item.category as BrowseCategory
  const itemSlug = slugify(build.item.name)

  // Persist the active variant in the URL (`?v=`) so a shared/bookmarked link
  // reopens on the same variant. The embed entry owns this differently (local
  // state, no router) — see src/embed-main.tsx.
  const onSelectVariant = (i: number) =>
    navigate({
      to: ".",
      params: true,
      search: (s) => (i === 0 ? { ...s, v: undefined } : { ...s, v: i }),
      replace: true,
    })

  // Re-key on variant switch so the per-variant hooks (useBuildSlots /
  // useArcaneSlots) re-initialize from the new variant's projected data.
  // Without this, the hooks keep their initial state across ?v= changes
  // and the loadout grid stays frozen on variant 0.
  return (
    <Suspense fallback={<BuildViewerFallback />}>
      <BuildViewerBody
        key={`${slug}-${v ?? 0}`}
        build={build}
        category={category}
        itemSlug={itemSlug}
        embed={embed}
        activeIndex={v}
        onSelectVariant={onSelectVariant}
      />
    </Suspense>
  )
}
