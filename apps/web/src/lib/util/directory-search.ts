// Search-param contract shared by the two public directories (/orgs, /users).
// Both take `?page` + `?q`; both drop the defaults from the URL so the bare
// path stays canonical.

import { toQueryString } from "./api-client"
import { searchPage, searchText } from "./search-params"

export type DirectorySearchParams = { page?: number; q?: string }

export function parseDirectorySearch(search: unknown): DirectorySearchParams {
  const raw = search as { page?: unknown; q?: unknown }
  const page = searchPage(raw.page)
  const q = searchText(raw.q)
  return { ...(q ? { q } : {}), ...(page ? { page } : {}) }
}

/** API query string for a directory page — the inverse of
 *  {@link parseDirectorySearch} (page 1 and an empty `q` are dropped). */
export function directoryQueryString(page: number, q?: string): string {
  return toQueryString({ page, q: q?.trim() }, { page: 1 })
}
