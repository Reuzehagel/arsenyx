import { LIST_LIMIT } from "@arsenyx/shared/api/build-list"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { SearchX } from "lucide-react"
import { useRef, type ReactNode } from "react"

import {
  BuildCollection,
  BuildCollectionSkeleton,
} from "@/components/builds/build-collection"
import { BuildsEmptyState } from "@/components/builds/builds-empty-state"
import type { ListViewParams } from "@/components/builds/builds-list-route"
import { BuildsSortDropdown } from "@/components/builds/builds-sort-dropdown"
import { BuildsLayoutToggle } from "@/components/builds/layout-toggle"
import { CategoryTabs } from "@/components/category-tabs"
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
import { HOTKEYS, useSearchHotkey } from "@/lib/hooks/hotkeys"
import { useUrlSearchInput } from "@/lib/hooks/use-url-search-input"
import type { publicBuildsQuery } from "@/lib/queries/builds-list-query"
import { cn } from "@/lib/util/utils"

type BuildsQuery = ReturnType<typeof publicBuildsQuery>

export function BuildsListView({
  title,
  description,
  query,
  params,
  onUpdateSearch,
  emptyState,
}: {
  title?: string
  description?: string
  query: BuildsQuery
  params: ListViewParams
  onUpdateSearch: (next: ListViewParams) => void
  emptyState: ReactNode
}) {
  const { page, sort, q, category, hasGuide, hasShards } = params

  // Any change but paging starts over at page 1.
  const patch = (next: Partial<ListViewParams>) =>
    onUpdateSearch({ ...params, page: 1, ...next })

  const [qLocal, setQLocal] = useUrlSearchInput(q, (next) => patch({ q: next }))

  const searchRef = useRef<HTMLInputElement>(null)
  useSearchHotkey(HOTKEYS.buildListSearch, searchRef)

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
        <InputGroup className="flex-1">
          <InputGroupInput
            ref={searchRef}
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
        <div className="flex gap-3">
          <BuildsLayoutToggle />
          <BuildsSortDropdown
            value={sort}
            onChange={(value) => patch({ sort: value })}
          />
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
        </div>
      </div>

      <CategoryTabs
        value={category ?? "all"}
        onChange={(next) =>
          patch({ category: next === "all" ? undefined : next })
        }
      />

      <Results
        query={query}
        page={page}
        q={q}
        isFiltered={isFiltered}
        onPage={(p) => patch({ page: p })}
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
  // Keep the current page on screen (dimmed) while the next one loads.
  const { data, isPending, isFetching } = useQuery({
    ...query,
    placeholderData: keepPreviousData,
  })

  if (isPending || !data) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className="flex flex-col gap-6"
      >
        <span className="sr-only">Loading builds…</span>
        <Skeleton className="h-4 w-32" />
        <BuildCollectionSkeleton count={LIST_LIMIT} />
      </div>
    )
  }

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
        <BuildCollection
          builds={data.builds}
          aria-busy={isFetching}
          className={cn("transition-opacity", isFetching && "opacity-60")}
        />
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
