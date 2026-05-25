import { useQuery } from "@tanstack/react-query"

import {
  BuildCard,
  BuildCardSkeleton,
  BuildRow,
  BuildRowSkeleton,
} from "@/components/builds/build-card"
import { useBuildLayout } from "@/lib/hooks/use-build-layout"
import { publicBuildsQuery } from "@/lib/queries/builds-list-query"
import type { DetailItem } from "@/lib/warframe"

// Cards: flex-wrap with fixed-width tiles so a small number of builds (e.g. 2)
// don't get stretched across the full row by `1fr` grid tracks. They align
// left, wrap, and leave natural unused space on the right.
const CARDS_CLASS = "flex flex-wrap gap-3 [&>*]:w-[240px] [&>*]:max-w-full"
const ROWS_CLASS = "flex flex-col gap-2"

const TOP_BUILDS_LIMIT = 6

export function TopBuildsSection({ item }: { item: DetailItem }) {
  const { data, isLoading } = useQuery(
    publicBuildsQuery({
      page: 1,
      sort: "top",
      item: item.uniqueName,
      limit: TOP_BUILDS_LIMIT,
    }),
  )
  const [layout] = useBuildLayout()
  const containerClass = layout === "rows" ? ROWS_CLASS : CARDS_CLASS

  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={containerClass}
      >
        <span className="sr-only">Loading top builds…</span>
        {Array.from({ length: TOP_BUILDS_LIMIT }).map((_, i) =>
          layout === "rows" ? (
            <BuildRowSkeleton key={i} />
          ) : (
            <BuildCardSkeleton key={i} />
          ),
        )}
      </div>
    )
  }

  const builds = data?.builds ?? []

  if (builds.length === 0) {
    return (
      <div className="border-border/50 bg-muted/20 flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <p className="text-muted-foreground text-sm">
          No community builds yet for {item.name}.
        </p>
        <p className="text-muted-foreground/70 text-xs">
          Be the first to share one.
        </p>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      {builds.map((b) =>
        layout === "rows" ? (
          <BuildRow key={b.id} build={b} />
        ) : (
          <BuildCard key={b.id} build={b} />
        ),
      )}
    </div>
  )
}
