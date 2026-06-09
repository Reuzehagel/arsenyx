// Shared constants for paginated build-list endpoints, used by both the api
// (query parsing / SQL) and the web client (query-string building, skeleton
// sizing). Single source of truth so the sort keys and page size can't drift.

export const LIST_LIMIT = 24

export const LIST_SORTS = [
  "newest",
  "updated",
  "top",
  "trending",
  "bookmarked",
  "viewed",
  "forma-asc",
  "forma-desc",
] as const

export type ListSort = (typeof LIST_SORTS)[number]
