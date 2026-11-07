import type { ListSort } from "@arsenyx/shared/api/build-list"

import { SortSelect } from "@/components/sort-select"

const SORT_ITEMS = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently Updated" },
  { value: "trending", label: "Trending" },
  { value: "top", label: "Most Liked" },
  { value: "bookmarked", label: "Most Bookmarked" },
  { value: "viewed", label: "Most Viewed" },
  { value: "forma-asc", label: "Fewest Forma" },
  { value: "forma-desc", label: "Most Forma" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
] as const satisfies readonly { value: ListSort; label: string }[]

export function BuildsSortDropdown({
  value,
  onChange,
}: {
  value: ListSort
  onChange: (value: ListSort) => void
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
