import { useQuery } from "@tanstack/react-query"

import { BuildCard, BuildCardSkeleton } from "@/components/builds/build-card"
import { publicBuildsQuery } from "@/lib/builds-list-query"
import type { DetailItem } from "@/lib/warframe"

// Flex-wrap with fixed-width cards so a small number of builds (e.g. 2)
// don't get stretched across the full row by `1fr` grid tracks. Cards
// align left, wrap to fill rows, and leave natural unused space on the
// right rather than ballooning each card.
const GRID_CLASS = "flex flex-wrap gap-3 [&>*]:w-[240px] [&>*]:max-w-full"

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

  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className={GRID_CLASS}
      >
        <span className="sr-only">Loading top builds…</span>
        {Array.from({ length: TOP_BUILDS_LIMIT }).map((_, i) => (
          <BuildCardSkeleton key={i} />
        ))}
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
    <div className={GRID_CLASS}>
      {builds.map((b) => (
        <BuildCard key={b.id} build={b} />
      ))}
    </div>
  )
}
