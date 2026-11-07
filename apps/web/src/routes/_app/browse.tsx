import {
  browseMeta,
  coerceBrowseCategory,
  type BrowseFilter,
} from "@arsenyx/shared/seo/browse-meta"
import { hasIncarnon } from "@arsenyx/shared/warframe/incarnon-data"
import type { BrowseItem } from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useDeferredValue, useMemo, useRef } from "react"

import {
  FilterDropdown,
  MASTERY_MAX,
} from "@/components/browse/filter-dropdown"
import { ItemCard, ItemCardSkeleton } from "@/components/browse/item-card"
import { SortDropdown } from "@/components/browse/sort-dropdown"
import { CategoryTabs } from "@/components/category-tabs"
import { DelayedSuspense } from "@/components/delayed-fallback"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { HOTKEYS, useSearchHotkey } from "@/lib/hooks/hotkeys"
import {
  allItems,
  SORT_VALUES,
  type SortOption,
  sortItems,
} from "@/lib/items-index"
import { itemsIndexQuery } from "@/lib/queries/items-index-query"
import { seo } from "@/lib/seo"
import {
  searchEnum,
  searchFlag,
  searchInt,
  searchText,
} from "@/lib/util/search-params"

type BrowseSearch = {
  category: BrowseFilter
  q?: string
  sort?: SortOption
  mastery?: number
  prime?: boolean
  vaulted?: boolean
  incarnon?: boolean
}

export const Route = createFileRoute("/_app/browse")({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => {
    const mastery = searchInt(search.mastery)
    return {
      category: coerceBrowseCategory(search.category),
      q: searchText(search.q),
      sort: searchEnum(search.sort, SORT_VALUES),
      mastery:
        mastery !== undefined && mastery >= 0 && mastery < MASTERY_MAX
          ? mastery
          : undefined,
      prime: searchFlag(search.prime),
      // "hide" is the pre-boolean spelling; old shared links still carry it.
      vaulted: search.vaulted === "hide" ? true : searchFlag(search.vaulted),
      incarnon: searchFlag(search.incarnon),
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(itemsIndexQuery),
  // Each category view is its own indexable page; the canonical strips
  // search/sort/filter params so filtered variants collapse onto it.
  head: ({ match }) => seo(browseMeta(match.search.category)),
  component: BrowsePage,
})

function BrowsePage() {
  return (
    <>
      <div className="wrap flex flex-col gap-6 py-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Browse Items</h1>
          <p className="text-muted-foreground">
            Find and explore Warframes, weapons, and companions for your builds.
          </p>
        </div>
        <DelayedSuspense fallback={<BrowseSkeleton />}>
          <BrowseContent />
        </DelayedSuspense>
      </div>
    </>
  )
}

function BrowseSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    >
      <span className="sr-only">Loading items…</span>
      {Array.from({ length: 18 }).map((_, i) => (
        <ItemCardSkeleton key={i} />
      ))}
    </div>
  )
}

function BrowseContent() {
  const { data } = useSuspenseQuery(itemsIndexQuery)
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const { category, q = "" } = search
  const sort = search.sort ?? "name-asc"
  const masteryMax = search.mastery ?? MASTERY_MAX
  const primeOnly = search.prime ?? false
  const hideVaulted = search.vaulted ?? false
  const incarnonOnly = search.incarnon ?? false

  const deferredQ = useDeferredValue(q)
  const searchRef = useRef<HTMLInputElement>(null)

  useSearchHotkey(HOTKEYS.browseSearch, searchRef)

  const items = useMemo(() => {
    if (category !== "all") return data[category] ?? []
    return allItems(data)
  }, [data, category])
  // A class every item shares ("Warframe" on the Warframes tab) just repeats
  // the tab. Judged on the whole category, not the filtered view, so the line
  // doesn't flicker in and out while typing a search.
  const showClass = useMemo(
    () => new Set(items.map((i) => i.displayClass)).size > 1,
    [items],
  )

  const visible = useMemo(
    () =>
      filterAndSort(items, {
        deferredQ,
        masteryMax,
        primeOnly,
        hideVaulted,
        incarnonOnly,
        sort,
      }),
    [items, deferredQ, masteryMax, primeOnly, hideVaulted, incarnonOnly, sort],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <InputGroup className="flex-1">
          <InputGroupInput
            ref={searchRef}
            placeholder="Search items…"
            value={q}
            onChange={(e) => {
              const next = e.target.value
              navigate({
                search: (s) => ({ ...s, q: next || undefined }),
                replace: true,
              })
            }}
          />
          {!q && (
            <InputGroupAddon align="inline-end">
              <Kbd>/</Kbd>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="flex gap-3">
          <SortDropdown
            value={sort}
            onChange={(value) =>
              navigate({
                search: (s) => ({
                  ...s,
                  sort: value === "name-asc" ? undefined : value,
                }),
                replace: true,
              })
            }
          />
          <FilterDropdown
            filters={{ masteryMax, primeOnly, hideVaulted, incarnonOnly }}
            onChange={(next) =>
              navigate({
                search: (s) => ({
                  ...s,
                  mastery:
                    next.masteryMax < MASTERY_MAX ? next.masteryMax : undefined,
                  prime: next.primeOnly ? true : undefined,
                  vaulted: next.hideVaulted ? true : undefined,
                  incarnon: next.incarnonOnly ? true : undefined,
                }),
                replace: true,
              })
            }
          />
        </div>
      </div>

      <CategoryTabs
        value={category}
        onChange={(next) =>
          navigate({
            search: (s) => ({ ...s, category: next }),
          })
        }
      />

      <div className="text-muted-foreground text-sm">
        {visible.length} {visible.length === 1 ? "item" : "items"}
        {q && ` matching "${q}"`}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No items match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((item) => (
            // Atmosphere arch-gun variants share `uniqueName` with their base
            // (e.g. Mausolon / Mausolon (Atmosphere)), so include the slug to
            // keep React keys unique within a category.
            <ItemCard
              key={`${item.uniqueName}|${item.slug}`}
              item={item}
              showClass={showClass}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function filterAndSort(
  items: BrowseItem[],
  {
    deferredQ,
    masteryMax,
    primeOnly,
    hideVaulted,
    incarnonOnly,
    sort,
  }: {
    deferredQ: string
    masteryMax: number
    primeOnly: boolean
    hideVaulted: boolean
    incarnonOnly: boolean
    sort: SortOption
  },
): BrowseItem[] {
  const term = deferredQ.trim().toLowerCase()

  const filtered = items.filter((item) => {
    if (term) {
      const nameMatch = item.name.toLowerCase().includes(term)
      const typeMatch = item.displayClass?.toLowerCase().includes(term)
      if (!nameMatch && !typeMatch) return false
    }
    if (item.masteryReq !== undefined && item.masteryReq > masteryMax)
      return false
    if (primeOnly && !item.isPrime) return false
    if (hideVaulted && item.vaulted) return false
    if (incarnonOnly && !hasIncarnon(item.name)) return false
    return true
  })

  return sortItems(filtered, sort)
}
