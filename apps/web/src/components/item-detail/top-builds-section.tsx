import type { BrowseCategory } from "@arsenyx/shared/warframe/types"
import { useQuery } from "@tanstack/react-query"

import {
  BuildCollection,
  BuildCollectionSkeleton,
} from "@/components/builds/build-collection"
import type { DetailItem } from "@/lib/catalog"
import { publicBuildsQuery } from "@/lib/queries/builds-list-query"

// Fixed-width tiles so a few builds (e.g. 2) aren't stretched across the row by
// `1fr` grid tracks; they align left and wrap.
const CARDS_CLASS = "flex flex-wrap gap-3 [&>*]:w-[240px] [&>*]:max-w-full"

const TOP_BUILDS_LIMIT = 6

export function TopBuildsSection({
  item,
  category,
}: {
  item: DetailItem
  category: BrowseCategory
}) {
  // No placeholderData: on item → item navigation the previous item's builds
  // must not stand in for this one's.
  const { data, isPending } = useQuery(
    publicBuildsQuery({
      page: 1,
      sort: "top",
      item: item.uniqueName,
      // Modular kitgun barrels share one uniqueName across their Primary and
      // Secondary forms, so itemUniqueName alone matches both. Pair it with the
      // page's category so each form only shows its own builds.
      category,
      limit: TOP_BUILDS_LIMIT,
    }),
  )

  if (isPending) {
    return (
      <BuildCollectionSkeleton
        count={TOP_BUILDS_LIMIT}
        cardsClassName={CARDS_CLASS}
        label="Loading top builds…"
      />
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

  return <BuildCollection builds={builds} cardsClassName={CARDS_CLASS} />
}
