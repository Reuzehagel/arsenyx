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
import { clampEmbedParams } from "@/lib/embed-params"
import { buildQuery } from "@/lib/queries/build-query"
import { isValidCategory, type BrowseCategory } from "@/lib/warframe"
import "@/styles/globals.css"

/**
 * Dedicated entry for `/builds/:slug?embed=1`, served by the Worker
 * (apps/web/worker/index.ts) instead of the full SPA shell. It mounts ONLY the
 * read-only viewer — no TanStack Router, no app chrome — so a guide page with
 * many embeds doesn't boot the entire app once per iframe. The slug comes from
 * the path; scale/bg/v come from the query string (mirroring the
 * `validateSearch` rules in routes/builds.$slug.tsx).
 */

function parseParams() {
  const p = new URLSearchParams(location.search)
  // In production the Worker serves embed.html at the real `/builds/<slug>`
  // path, so the slug comes from the path. The `?slug=` fallback is for dev /
  // vite preview, where embed.html is reached directly at `/embed.html` and the
  // path carries no slug.
  const slug = decodeURIComponent(
    location.pathname.split("/")[2] ?? p.get("slug") ?? "",
  )
  const num = (v: string | null) => {
    if (v === null) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  // Bounds logic is shared with the SPA route's validateSearch — see
  // clampEmbedParams. Coerce the URLSearchParams strings first, then clamp.
  const { scale, bg, v } = clampEmbedParams({
    scale: num(p.get("scale")),
    bg: p.get("bg") ?? undefined,
    v: num(p.get("v")),
  })

  return { slug, scale, bg, v }
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
  const category = build.item.category as BrowseCategory
  const itemSlug = slugify(build.item.name)

  // No inner Suspense: BuildViewerBody's own useSuspenseQuery calls bubble up to
  // the single boundary in EmbedApp (mirrors routes/builds.$slug.tsx, one
  // Suspense per render path).
  return (
    <BuildViewerBody
      key={`${slug}-${activeIndex ?? 0}`}
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
