import { useQuery } from "@tanstack/react-query"

import { BuildCard, BuildCardSkeleton } from "@/components/builds/build-card"
import { publicBuildsQuery } from "@/lib/builds-list-query"
import type { DetailItem } from "@/lib/warframe"

const GRID_CLASS =
  "grid gap-3 grid-cols-[repeat(auto-fit,minmax(190px,1fr))] [&>*]:max-w-[240px]"

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
