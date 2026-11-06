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
  "name-asc",
  "name-desc",
] as const

export type ListSort = (typeof LIST_SORTS)[number]

/** The sort each list endpoint applies when `?sort` is absent. The client
 *  omits `sort` when it equals this, so both sides must read the same value. */
export const LIST_DEFAULT_SORTS = {
  public: "newest",
  mine: "updated",
  bookmarks: "newest",
  user: "newest",
  org: "newest",
} as const satisfies Record<string, ListSort>

export type ListScope = keyof typeof LIST_DEFAULT_SORTS
