import { useNavigate } from "@tanstack/react-router"
import { Suspense, type ReactNode } from "react"

import { DirectorySearch } from "@/components/directory-search"
import { Pagination } from "@/components/pagination"
import type { DirectorySearchParams } from "@/lib/util/directory-search"

type DirectoryPath = "/orgs" | "/users"

/**
 * A public directory page (`/orgs`, `/users`): heading, debounced search, and
 * `children` — the route's results, which suspend on their query and render a
 * {@link DirectoryGrid}.
 */
export function DirectoryPage({
  path,
  search,
  title,
  description,
  noun,
  children,
}: {
  path: DirectoryPath
  search: DirectorySearchParams
  title: string
  description: string
  /** Plural, lowercase: "organizations". */
  noun: string
  children: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <div className="wrap flex max-w-5xl flex-col gap-8 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <DirectorySearch
        value={search.q ?? ""}
        // A new query invalidates the current page — result 21 of the old
        // query has nothing to do with the new one.
        onSearch={(q) => navigate({ to: path, search: q ? { q } : {} })}
        placeholder={`Search ${noun}…`}
        label={`Search ${noun}`}
      />
      {/* Keyed on the query so a new search shows the fallback instead of
          holding the previous page's rows while the loader resolves. */}
      <Suspense
        key={`${search.q ?? ""}:${search.page ?? 1}`}
        fallback={
          <p className="text-muted-foreground text-sm">Loading {noun}…</p>
        }
      >
        {children}
      </Suspense>
    </div>
  )
}

/** One page of directory results: card grid + pagination, or the empty
 *  message. */
export function DirectoryGrid<T extends { id: string }>({
  path,
  search,
  noun,
  emptyMessage,
  items,
  total,
  limit,
  renderItem,
}: {
  path: DirectoryPath
  search: DirectorySearchParams
  noun: string
  emptyMessage: string
  items: T[]
  total: number
  limit: number
  renderItem: (item: T) => ReactNode
}) {
  const navigate = useNavigate()
  const page = search.page ?? 1
  const q = search.q
  const searchFor = (p: number) => ({
    ...(q ? { q } : {}),
    ...(p > 1 ? { page: p } : {}),
  })

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {q ? `No ${noun} match "${q}".` : emptyMessage}
      </p>
    )
  }

  return (
    <>
      {/* auto-rows-fr: every row matches the tallest card on the page, so a
          row without bios is not shorter than one with them. */}
      <ul className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>{renderItem(item)}</li>
        ))}
      </ul>
      <Pagination
        page={page}
        total={total}
        limit={limit}
        onPage={(p) => navigate({ to: path, search: searchFor(p) })}
        href={(p) => {
          const qs = new URLSearchParams(
            Object.entries(searchFor(p)).map(([k, v]) => [k, String(v)]),
          ).toString()
          return qs ? `${path}?${qs}` : path
        }}
      />
    </>
  )
}
