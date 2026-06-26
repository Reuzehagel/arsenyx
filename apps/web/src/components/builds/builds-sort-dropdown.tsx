import { SortSelect } from "@/components/sort-select"
import type { BuildListSort } from "@/lib/queries/builds-list-query"

const SORT_ITEMS = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently Updated" },
  { value: "trending", label: "Trending" },
  { value: "top", label: "Most Liked" },
  { value: "bookmarked", label: "Most Bookmarked" },
  { value: "viewed", label: "Most Viewed" },
  { value: "forma-asc", label: "Fewest Forma" },
  { value: "forma-desc", label: "Most Forma" },
] as const

export const SORT_VALUES: BuildListSort[] = SORT_ITEMS.map((i) => i.value)

export function BuildsSortDropdown({
  value,
  onChange,
}: {
  value: BuildListSort
  onChange: (value: BuildListSort) => void
}) {
  return (
    <SortSelect
      items={SORT_ITEMS}
      value={value}
      onChange={onChange}
      // Stretches to fill the stacked toolbar row on phones (so the layout
      // toggle and Filters button pin to the row's edges instead of leaving a
      // ragged gap); fixed width once it sits inline beside the search at sm+.
      triggerWidth="flex-1 sm:w-44 sm:flex-none"
    />
  )
}
