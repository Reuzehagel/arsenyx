import { useQuery } from "@tanstack/react-query"
import { Filter } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { BuildCard, BuildCardSkeleton } from "@/components/builds/build-card"
import { BuildsCategoryTabs } from "@/components/builds/builds-category-tabs"
import { BuildsSortDropdown } from "@/components/builds/builds-sort-dropdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  LIST_PAGE_SIZE,
  publicBuildsQuery,
  type BuildListSort,
} from "@/lib/builds-list-query"
import { cn } from "@/lib/utils"
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

/** Materialize the loader deps every builds-list route needs, filling in the
 *  defaults the list component will use anyway. */
export function buildsListLoaderDeps(
  search: BuildsListSearch,
  defaultSort: BuildListSort,
) {
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

export const BUILDS_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"

export function BuildsListView({
  title,
  description,
  query,
  page,
  sort,
  q,
  category,
  hasGuide,
  hasShards,
  onUpdateSearch,
  emptyState,
  showFilters,
}: {
  title?: string
  description?: string
  query: BuildsQuery
  page: number
  sort: BuildListSort
  q: string
  category: BrowseCategory | undefined
  hasGuide: boolean
  hasShards: boolean
  onUpdateSearch: (next: BuildsListSearch) => void
  emptyState: ReactNode
  showFilters: boolean
}) {
  const [qLocal, setQLocal] = useState(q)
  useEffect(() => setQLocal(q), [q])

  useEffect(() => {
    if (qLocal === q) return
    const t = setTimeout(() => {
      onUpdateSearch({
        sort,
        category,
        q: qLocal || undefined,
        page: undefined,
        hasGuide: hasGuide || undefined,
        hasShards: hasShards || undefined,
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [qLocal, q, sort, category, hasGuide, hasShards, onUpdateSearch])

  const activeFilterCount = (hasGuide ? 1 : 0) + (hasShards ? 1 : 0)

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
          <BuildsSortDropdown
            value={sort}
            onChange={(value) =>
              onUpdateSearch({
                sort: value,
                q,
                category,
                hasGuide: hasGuide || undefined,
                hasShards: hasShards || undefined,
                page: undefined,
              })
            }
          />
          {showFilters ? (
            <Popover>
              <PopoverTrigger
                render={<Button variant="outline" className="shrink-0 gap-2" />}
              >
                <Filter data-icon="inline-start" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 gap-3">
                <FilterToggle
                  label="Has guide"
                  checked={hasGuide}
                  onChange={(v) =>
                    onUpdateSearch({
                      sort,
                      q,
                      category,
                      hasGuide: v || undefined,
                      hasShards: hasShards || undefined,
                      page: undefined,
                    })
                  }
                />
                <FilterToggle
                  label="Has archon shards"
                  checked={hasShards}
                  onChange={(v) =>
                    onUpdateSearch({
                      sort,
                      q,
                      category,
                      hasGuide: hasGuide || undefined,
                      hasShards: v || undefined,
                      page: undefined,
                    })
                  }
                />
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <BuildsCategoryTabs
          value={category}
          onChange={(next) =>
            onUpdateSearch({
              sort,
              q,
              category: next,
              hasGuide: hasGuide || undefined,
              hasShards: hasShards || undefined,
              page: undefined,
            })
          }
        />
      ) : null}

      <Results
        query={query}
        page={page}
        q={q}
        sort={sort}
        category={category}
        hasGuide={hasGuide}
        hasShards={hasShards}
        onUpdateSearch={onUpdateSearch}
        emptyState={emptyState}
      />
    </div>
  )
}

function Results({
  query,
  page,
  q,
  sort,
  category,
  hasGuide,
  hasShards,
  onUpdateSearch,
  emptyState,
}: {
  query: BuildsQuery
  page: number
  q: string
  sort: BuildListSort
  category: BrowseCategory | undefined
  hasGuide: boolean
  hasShards: boolean
  onUpdateSearch: (next: BuildsListSearch) => void
  emptyState: ReactNode
}) {
  const { data, isPending, isFetching } = useQuery(query)

  if (isPending || !data) return <ResultsSkeleton />

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  return (
    <>
      <div className="text-muted-foreground text-sm">
        {data.total} {data.total === 1 ? "build" : "builds"}
        {q ? ` matching "${q}"` : ""}
      </div>

      {data.builds.length === 0 ? (
        <div className="py-16 text-center">{emptyState}</div>
      ) : (
        <div
          aria-busy={isFetching}
          className={cn(
            BUILDS_GRID_CLASS,
            "transition-opacity",
            isFetching && "opacity-60",
          )}
        >
          {data.builds.map((b) => (
            <BuildCard key={b.id} build={b} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 pt-2">
          {page > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdateSearch({
                  sort,
                  q,
                  category,
                  hasGuide: hasGuide || undefined,
                  hasShards: hasShards || undefined,
                  page: page - 1 === 1 ? undefined : page - 1,
                })
              }
            >
              Previous
            </Button>
          ) : null}
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdateSearch({
                  sort,
                  q,
                  category,
                  hasGuide: hasGuide || undefined,
                  hasShards: hasShards || undefined,
                  page: page + 1,
                })
              }
            >
              Next
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function ResultsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Loading builds…</span>
      <Skeleton className="h-4 w-32" />
      <div className={BUILDS_GRID_CLASS}>
        {Array.from({ length: LIST_PAGE_SIZE }).map((_, i) => (
          <BuildCardSkeleton key={i} />
        ))}
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
          <Skeleton className="h-9 w-32" />
          {showFilters && <Skeleton className="h-9 w-24" />}
        </div>
      </div>
      {showFilters && <Skeleton className="h-8 w-full max-w-md" />}
      <Skeleton className="h-4 w-32" />
      <div className={BUILDS_GRID_CLASS}>
        {Array.from({ length: LIST_PAGE_SIZE }).map((_, i) => (
          <BuildCardSkeleton key={i} />
        ))}
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
