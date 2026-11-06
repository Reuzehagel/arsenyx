// Search-param contract shared by every builds-list route (/builds,
// /builds/mine, /bookmarks, profiles, orgs): parse the URL, resolve defaults
// for the loader, and strip them again on the way back so URLs stay clean.

import { LIST_SORTS, type ListSort } from "@arsenyx/shared/api/build-list"
import { BUILD_SEARCH_Q_MAX } from "@arsenyx/shared/api/limits"
import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import type { BrowseCategory } from "@arsenyx/shared/warframe/types"
import { useNavigate } from "@tanstack/react-router"

import type { BuildListParams } from "@/lib/queries/builds-list-query"
import {
  searchEnum,
  searchFlag,
  searchPage,
  searchText,
} from "@/lib/util/search-params"

type BuildsListSearch = {
  page?: number
  sort?: ListSort
  q?: string
  category?: BrowseCategory
  hasGuide?: boolean
  hasShards?: boolean
}

/** The BuildListParams filters the list view drives, every one resolved:
 *  what the query and the list view consume. */
export type ListViewParams = Required<
  Pick<BuildListParams, "page" | "sort" | "q" | "hasGuide" | "hasShards">
> & { category: BrowseCategory | undefined }

function parseBuildsListSearch(
  search: Record<string, unknown>,
): BuildsListSearch {
  return {
    page: searchPage(search.page),
    sort: searchEnum(search.sort, LIST_SORTS),
    q: searchText(search.q, BUILD_SEARCH_Q_MAX),
    category:
      typeof search.category === "string" && isValidCategory(search.category)
        ? search.category
        : undefined,
    hasGuide: searchFlag(search.hasGuide),
    hasShards: searchFlag(search.hasShards),
  }
}

/**
 * Route options + hook for one builds-list route, with its default sort
 * defined once. Spread `routeOptions` into `createFileRoute(...)`; the page
 * calls `useListSearch(Route.useSearch())`.
 */
export function buildsListRoute(defaultSort: ListSort) {
  const resolve = (search: BuildsListSearch): ListViewParams => ({
    page: search.page ?? 1,
    sort: search.sort ?? defaultSort,
    q: search.q ?? "",
    category: search.category,
    hasGuide: search.hasGuide ?? false,
    hasShards: search.hasShards ?? false,
  })
  // Defaults are dropped so the bare path stays canonical.
  const toSearch = (p: ListViewParams): BuildsListSearch => ({
    page: p.page > 1 ? p.page : undefined,
    sort: p.sort !== defaultSort ? p.sort : undefined,
    q: p.q || undefined,
    category: p.category,
    hasGuide: p.hasGuide || undefined,
    hasShards: p.hasShards || undefined,
  })
  return {
    routeOptions: {
      validateSearch: parseBuildsListSearch,
      loaderDeps: ({ search }: { search: BuildsListSearch }) => resolve(search),
    },
    useListSearch(search: BuildsListSearch) {
      const navigate = useNavigate()
      return {
        params: resolve(search),
        onUpdateSearch: (next: ListViewParams) =>
          void navigate({ to: ".", search: toSearch(next), replace: true }),
      }
    },
  }
}
