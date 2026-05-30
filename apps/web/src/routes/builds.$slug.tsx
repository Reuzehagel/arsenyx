import { clamp } from "@arsenyx/shared"
import { MAX_VARIANT_PARSE_INDEX } from "@arsenyx/shared/warframe/build-doc"
import { slugify } from "@arsenyx/shared/warframe/slugs"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

import {
  BuildNotFound,
  BuildViewerBody,
  EmbedShell,
} from "@/components/build-viewer"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { buildQuery } from "@/lib/queries/build-query"
import { isValidCategory, type BrowseCategory } from "@/lib/warframe"

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
    const rawScale = num(s.scale)
    const scale = rawScale !== undefined ? clamp(rawScale, 0.1, 2) : undefined
    const bg = typeof s.bg === "string" && s.bg.length > 0 ? s.bg : undefined
    const rawV = num(s.v)
    // 0-indexed; default (undefined) means "first variant". Clamped to a
    // generous upper bound here; the viewer further clamps to the actual
    // variant count.
    const v =
      rawV !== undefined && rawV >= 0
        ? Math.min(MAX_VARIANT_PARSE_INDEX, Math.floor(rawV))
        : undefined
    return {
      ...(embed && { embed }),
      ...(scale !== undefined && { scale }),
      ...(bg !== undefined && { bg }),
      ...(v !== undefined && { v }),
    }
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(buildQuery(params.slug)),
  component: BuildPage,
  notFoundComponent: BuildNotFound,
})

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
          <Suspense
            fallback={<p className="text-muted-foreground">Loading build…</p>}
          >
            <BuildViewer />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function BuildViewer({ embed = false }: { embed?: boolean }) {
  const { slug } = Route.useParams()
  const { v } = Route.useSearch()
  const { data: build } = useSuspenseQuery(buildQuery(slug))

  if (!isValidCategory(build.item.category)) {
    return <p className="text-muted-foreground">Unsupported category.</p>
  }
  const category = build.item.category as BrowseCategory
  const itemSlug = slugify(build.item.name)

  // Re-key on variant switch so the per-variant hooks (useBuildSlots /
  // useArcaneSlots) re-initialize from the new variant's projected data.
  // Without this, the hooks keep their initial state across ?v= changes
  // and the loadout grid stays frozen on variant 0.
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading item…</p>}>
      <BuildViewerBody
        key={`${slug}-${v ?? 0}`}
        build={build}
        category={category}
        itemSlug={itemSlug}
        embed={embed}
        activeIndex={v}
      />
    </Suspense>
  )
}
