import { hasIncarnon } from "@arsenyx/shared/warframe/incarnon-data"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense, useDeferredValue, useEffect, useMemo, useRef } from "react"

import { CategoryTabs } from "@/components/browse/category-tabs"
import {
  FilterDropdown,
  MASTERY_MAX,
} from "@/components/browse/filter-dropdown"
import { ItemCard } from "@/components/browse/item-card"
import {
  SortDropdown,
  SORT_VALUES,
  type SortOption,
} from "@/components/browse/sort-dropdown"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { itemsIndexQuery } from "@/lib/items-index-query"
import {
  isValidCategory,
  type BrowseCategory,
  type BrowseItem,
} from "@/lib/warframe"

type BrowseSearch = {
  category: BrowseCategory
  q?: string
  sort?: SortOption
  mastery?: number
  prime?: boolean
  vaulted?: boolean
  incarnon?: boolean
}

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => {
    const category =
      typeof search.category === "string" && isValidCategory(search.category)
        ? search.category
        : "warframes"
    const q =
      typeof search.q === "string" && search.q.length > 0 ? search.q : undefined
    const sort =
      typeof search.sort === "string" &&
      SORT_VALUES.includes(search.sort as SortOption)
        ? (search.sort as SortOption)
        : undefined
    const masteryNum =
      typeof search.mastery === "string"
        ? parseInt(search.mastery, 10)
        : typeof search.mastery === "number"
          ? search.mastery
          : NaN
    const mastery =
      !Number.isNaN(masteryNum) && masteryNum >= 0 && masteryNum < MASTERY_MAX
        ? masteryNum
        : undefined
    const prime =
      search.prime === true || search.prime === "true" ? true : undefined
    const vaulted =
      search.vaulted === true ||
      search.vaulted === "true" ||
      search.vaulted === "hide"
        ? true
        : undefined
    const incarnon =
      search.incarnon === true || search.incarnon === "true" ? true : undefined
    return { category, q, sort, mastery, prime, vaulted, incarnon }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(itemsIndexQuery),
  component: BrowsePage,
})

function BrowsePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Browse Items</h1>
            <p className="text-muted-foreground">
              Find and explore Warframes, weapons, and companions for your
              builds.
            </p>
          </div>
          <Suspense
            fallback={<p className="text-muted-foreground">Loading items…</p>}
          >
            <BrowseContent />
          </Suspense>
        </div>
      </main>
      <Footer />
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return
      const target = e.target as HTMLElement | null
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return
      }
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const items = useMemo(() => data[category] ?? [], [data, category])

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
        activeCategory={category}
        onChange={(next) =>
          navigate({
            search: (s) => ({ ...s, category: next, q: undefined }),
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
          {visible.map((item, i) => (
            <ItemCard key={item.uniqueName} item={item} index={i} />
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
      const typeMatch = item.type?.toLowerCase().includes(term)
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

function sortItems(items: BrowseItem[], option: SortOption): BrowseItem[] {
  const sorted = [...items]
  switch (option) {
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    case "date-desc":
      return sorted.sort((a, b) =>
        (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""),
      )
    case "date-asc":
      return sorted.sort((a, b) =>
        (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""),
      )
  }
}
