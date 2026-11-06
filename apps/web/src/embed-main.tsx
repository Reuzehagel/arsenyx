import { clamp } from "@arsenyx/shared/util/math"
import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import { slugify } from "@arsenyx/shared/warframe/slugs"
import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from "@tanstack/react-query"
import React, { Component, Suspense, useState, type ReactNode } from "react"
import ReactDOM from "react-dom/client"

// Deep imports, not the `@/components/build-viewer` barrel: the barrel
// statically re-exports the full-page chrome (ViewerHeader, GuideDisplay, …),
// which would pull TanStack Router + react-markdown — and even the site Header —
// into the embed bundle and defeat the lazy-loading in build-viewer-body.
import { BuildViewerBody } from "@/components/build-viewer/build-viewer-body"
import { EmbedShell } from "@/components/build-viewer/embed-shell"
import { buildQuery } from "@/lib/queries/build-query"
import { parseVariantIndex } from "@/lib/util/search-params"
import "@/styles/globals.css"

/**
 * Dedicated entry for `/builds/:slug?embed=1`, served instead of the SPA shell
 * by the Worker (apps/web/worker/index.ts) and the dev server (vite.config.ts).
 * It mounts ONLY the read-only viewer — no TanStack Router, no app chrome — so
 * a guide page with many embeds doesn't boot the entire app once per iframe.
 */

function parseParams() {
  const p = new URLSearchParams(location.search)
  const slug = decodeURIComponent(location.pathname.split("/")[2] ?? "")
  const scaleRaw = Number(p.get("scale") ?? NaN)
  return {
    slug,
    /** CSS zoom for the whole embed (0.9 = 90%). */
    scale: Number.isFinite(scaleRaw) ? clamp(scaleRaw, 0.1, 2) : undefined,
    /** Host-page background (hex without #) so the embed blends in. */
    bg: p.get("bg") || undefined,
    v: parseVariantIndex(p.get("v")),
  }
}

function EmbedViewer({
  slug,
  activeIndex,
  onSelectVariant,
}: {
  slug: string
  activeIndex: number | undefined
  onSelectVariant: (index: number) => void
}) {
  // countView: false → fetches `?view=0`: no view-count bump (embed
  // impressions aren't build views) and a browser-cacheable response.
  const { data: build } = useSuspenseQuery(
    buildQuery(slug, { countView: false }),
  )

  if (!isValidCategory(build.item.category)) {
    return (
      <p className="text-muted-foreground p-4 text-sm">Unsupported build.</p>
    )
  }
  const category = build.item.category
  const itemSlug = slugify(build.item.name)

  // No inner Suspense: BuildViewerBody's own useSuspenseQuery calls bubble up to
  // the single boundary in EmbedApp.
  return (
    <BuildViewerBody
      key={slug}
      build={build}
      category={category}
      itemSlug={itemSlug}
      embed
      activeIndex={activeIndex}
      onSelectVariant={onSelectVariant}
    />
  )
}

function EmbedApp({
  slug,
  scale,
  bg,
  initialVariant,
}: {
  slug: string
  scale: number | undefined
  bg: string | undefined
  initialVariant: number | undefined
}) {
  // No router in the embed, so the active variant lives in local state instead
  // of `?v=`. Initialised from the `v` query param.
  const [activeIndex, setActiveIndex] = useState<number | undefined>(
    initialVariant,
  )
  return (
    <EmbedShell scale={scale} bg={bg}>
      <Suspense
        fallback={
          <p className="text-muted-foreground p-4 text-sm">Loading build…</p>
        }
      >
        <EmbedViewer
          slug={slug}
          activeIndex={activeIndex}
          onSelectVariant={setActiveIndex}
        />
      </Suspense>
    </EmbedShell>
  )
}

/** buildQuery throws TanStack Router's `notFound()` on a 404 (and other errors
 *  on failure). With no router to catch it, a local boundary keeps the iframe
 *  from rendering React's blank error screen. */
class EmbedErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return (
        <p className="text-muted-foreground p-4 text-sm">
          This build couldn’t be loaded.
        </p>
      )
    }
    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } },
})

const { slug, scale, bg, v } = parseParams()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <EmbedErrorBoundary>
        {slug ? (
          <EmbedApp slug={slug} scale={scale} bg={bg} initialVariant={v} />
        ) : (
          <p className="text-muted-foreground p-4 text-sm">
            No build specified.
          </p>
        )}
      </EmbedErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
)
