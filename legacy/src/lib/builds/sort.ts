export type BuildSortBy = "newest" | "updated" | "votes" | "views"

export const BUILD_SORT_OPTIONS: { value: BuildSortBy; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Updated" },
  { value: "votes", label: "Most Voted" },
  { value: "views", label: "Most Viewed" },
]
