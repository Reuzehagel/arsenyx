import { useQuery } from "@tanstack/react-query"
import { SearchX } from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import {
  BuildCard,
  BuildCardSkeleton,
  BuildRow,
  BuildRowSkeleton,
} from "@/components/builds/build-card"
import { BuildsCategoryTabs } from "@/components/builds/builds-category-tabs"
import { BuildsEmptyState } from "@/components/builds/builds-empty-state"
import { BuildsSortDropdown } from "@/components/builds/builds-sort-dropdown"
import {
  BuildsLayoutToggle,
  buildLayoutClass,
} from "@/components/builds/layout-toggle"
import { FilterPopoverTrigger } from "@/components/filter-popover-trigger"
import { Pagination } from "@/components/pagination"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useBuildLayout } from "@/lib/hooks/use-build-layout"
import {
  LIST_PAGE_SIZE,
  publicBuildsQuery,
  type BuildListSort,
} from "@/lib/queries/builds-list-query"
import { cn } from "@/lib/util/utils"
import { isValidCategory, type BrowseCategory } from "@/lib/warframe"

import { SORT_VALUES } from "./builds-sort-dropdown"

type BuildsQuery = ReturnType<typeof publicBuildsQuery>

export type BuildsListSearch = {
  page?: number
  sort?: BuildListSort
  q?: string
  category?: string
  hasGuide?: boolean
  hasShards?: boolean
}

/** URL → typed search. Identical for every list route; the route's own
 *  validateSearch just calls this. */
export function parseBuildsListSearch(search: Record<string, unknown>): {
  page?: number
  sort?: BuildListSort
  q?: string
  category?: BrowseCategory
  hasGuide?: boolean
  hasShards?: boolean
} {
  const rawPage =
    typeof search.page === "string"
      ? parseInt(search.page, 10)
      : typeof search.page === "number"
        ? search.page
        : NaN
  const page = Number.isFinite(rawPage) && rawPage > 1 ? rawPage : undefined
  const sort =
    typeof search.sort === "string" &&
    (SORT_VALUES as string[]).includes(search.sort)
      ? (search.sort as BuildListSort)
      : undefined
  const q =
    typeof search.q === "string" && search.q.length > 0
      ? search.q.slice(0, 200)
      : undefined
  const category =
    typeof search.category === "string" && isValidCategory(search.category)
      ? (search.category as BrowseCategory)
      : undefined
  const hasGuide = search.hasGuide === true || undefined
  const hasShards = search.hasShards === true || undefined
  return { page, sort, q, category, hasGuide, hasShards }
}

/** Fully-resolved list params: every field defaulted, ready for the query and
 *  the list view. */
export type BuildsListParams = {
  page: number
  sort: BuildListSort
  q: string
  category: BrowseCategory | undefined
  hasGuide: boolean
  hasShards: boolean
}

/** Materialize the loader deps every builds-list route needs, filling in the
 *  defaults the list component will use anyway. */
export function buildsListLoaderDeps(
  search: BuildsListSearch,
  defaultSort: BuildListSort,
): BuildsListParams {
  return {
    page: search.page ?? 1,
    sort: search.sort ?? defaultSort,
    q: search.q ?? "",
    category: search.category as BrowseCategory | undefined,
    hasGuide: search.hasGuide ?? false,
    hasShards: search.hasShards ?? false,
  }
}

/** Strip defaults from `next` so the URL stays clean. */
export function nextBuildsListSearch(
  next: BuildsListSearch,
  defaultSort: BuildListSort,
) {
  return {
    page: next.page && next.page > 1 ? next.page : undefined,
    sort: next.sort && next.sort !== defaultSort ? next.sort : undefined,
    q: next.q || undefined,
    category: (next.category as BrowseCategory | undefined) || undefined,
    hasGuide: next.hasGuide || undefined,
    hasShards: next.hasShards || undefined,
  }
}

const SEARCH_DEBOUNCE_MS = 200

export const BUILDS_GRID_CLASS = buildLayoutClass("cards")

export function BuildsListView({
  title,
  description,
  query,
  params,
  onUpdateSearch,
  emptyState,
  showFilters,
}: {
  title?: string
  description?: string
  query: BuildsQuery
  params: BuildsListParams
  onUpdateSearch: (next: BuildsListSearch) => void
  emptyState: ReactNode
  showFilters: boolean
}) {
  const { page, sort, q, category, hasGuide, hasShards } = params

  const [qLocal, setQLocal] = useState(q)
  useEffect(() => setQLocal(q), [q])

  // Merge `next` over current search state, then normalize the optional fields
  // the URL wants stripped: q/hasGuide/hasShards collapse falsy → undefined and
  // page resets unless explicitly carried over.
  const patch = useCallback(
    (next: Partial<BuildsListSearch>) => {
      const merged = {
        sort,
        q,
        category,
        hasGuide,
        hasShards,
        page: undefined as number | undefined,
        ...next,
      }
      onUpdateSearch({
        sort: merged.sort,
        q: merged.q || undefined,
        category: merged.category,
        hasGuide: merged.hasGuide || undefined,
        hasShards: merged.hasShards || undefined,
        page: merged.page,
      })
    },
    [sort, q, category, hasGuide, hasShards, onUpdateSearch],
  )

  useEffect(() => {
    if (qLocal === q) return
    const t = setTimeout(() => {
      patch({ q: qLocal })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [qLocal, q, patch])

  const activeFilterCount = (hasGuide ? 1 : 0) + (hasShards ? 1 : 0)
  // A search, category tab, or toggle is narrowing the list. Zero results then
  // means "nothing matched", not "this list is empty" — so the route's own
  // empty state (its create-a-build CTA) shouldn't show.
  const isFiltered = Boolean(q) || Boolean(category) || hasGuide || hasShards

  return (
    <div className="flex flex-col gap-6">
      {title || description ? (
        <div className="flex flex-col gap-2">
          {title ? (
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          ) : null}
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {showFilters ? (
          <InputGroup className="flex-1">
            <InputGroupInput
              placeholder="Search builds…"
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
            />
            {!qLocal && (
              <InputGroupAddon align="inline-end">
                <Kbd>/</Kbd>
              </InputGroupAddon>
            )}
          </InputGroup>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex gap-3">
          <BuildsLayoutToggle />
          <BuildsSortDropdown
            value={sort}
            onChange={(value) => patch({ sort: value })}
          />
          {showFilters ? (
            <Popover>
              <FilterPopoverTrigger count={activeFilterCount} />
              <PopoverContent align="end" className="w-56 gap-3">
                <FilterToggle
                  label="Has guide"
                  checked={hasGuide}
                  onChange={(v) => patch({ hasGuide: v })}
                />
                <FilterToggle
                  label="Has archon shards"
                  checked={hasShards}
                  onChange={(v) => patch({ hasShards: v })}
                />
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <BuildsCategoryTabs
          value={category}
          onChange={(next) => patch({ category: next })}
        />
      ) : null}

      <Results
        query={query}
        page={page}
        q={q}
        isFiltered={isFiltered}
        onPage={(p) => patch({ page: p > 1 ? p : undefined })}
        emptyState={emptyState}
      />
    </div>
  )
}

function Results({
  query,
  page,
  q,
  isFiltered,
  onPage,
  emptyState,
}: {
  query: BuildsQuery
  page: number
  q: string
  isFiltered: boolean
  onPage: (p: number) => void
  emptyState: ReactNode
}) {
  const { data, isPending, isFetching } = useQuery(query)
  const [layout] = useBuildLayout()

  if (isPending || !data) return <ResultsSkeleton />

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  return (
    <>
      <div className="text-muted-foreground text-sm">
        {data.total} {data.total === 1 ? "build" : "builds"}
        {q ? ` matching "${q}"` : ""}
      </div>

      {data.builds.length === 0 ? (
        <div className="py-16">
          {isFiltered ? (
            <BuildsEmptyState
              icon={SearchX}
              title="No builds match"
              description="Try a different search, or clear your filters."
            />
          ) : (
            emptyState
          )}
        </div>
      ) : (
        <div
          aria-busy={isFetching}
          className={cn(
            buildLayoutClass(layout),
            "transition-opacity",
            isFetching && "opacity-60",
          )}
        >
          {data.builds.map((b) =>
            layout === "rows" ? (
              <BuildRow key={b.id} build={b} />
            ) : (
              <BuildCard key={b.id} build={b} />
            ),
          )}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex justify-center pt-2">
          <Pagination
            page={page}
            total={data.total}
            limit={data.limit}
            onPage={onPage}
          />
        </div>
      ) : null}
    </>
  )
}

function ResultsSkeleton() {
  const [layout] = useBuildLayout()
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Loading builds…</span>
      <Skeleton className="h-4 w-32" />
      <div className={buildLayoutClass(layout)}>
        {Array.from({ length: LIST_PAGE_SIZE }).map((_, i) =>
          layout === "rows" ? (
            <BuildRowSkeleton key={i} />
          ) : (
            <BuildCardSkeleton key={i} />
          ),
        )}
      </div>
    </div>
  )
}

/** Full-page builds list skeleton (chrome + results). */
export function BuildsListSkeleton({
  showFilters = true,
  showHeader = true,
}: {
  showFilters?: boolean
  showHeader?: boolean
}) {
  const [layout] = useBuildLayout()
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Loading builds…</span>
      {showHeader && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-80" />
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-9 flex-1" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
          {showFilters && <Skeleton className="h-9 w-24" />}
        </div>
      </div>
      {showFilters && <Skeleton className="h-8 w-full max-w-md" />}
      <Skeleton className="h-4 w-32" />
      <div className={buildLayoutClass(layout)}>
        {Array.from({ length: LIST_PAGE_SIZE }).map((_, i) =>
          layout === "rows" ? (
            <BuildRowSkeleton key={i} />
          ) : (
            <BuildCardSkeleton key={i} />
          ),
        )}
      </div>
    </div>
  )
}

function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="hover:bg-muted/50 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
