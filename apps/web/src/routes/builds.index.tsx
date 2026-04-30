import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"

import {
  BuildsListView,
  buildsListLoaderDeps,
  nextBuildsListSearch,
  parseBuildsListSearch,
  type BuildsListSearch,
} from "@/components/builds/builds-list-view"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { publicBuildsQuery, type BuildListSort } from "@/lib/builds-list-query"
import { type BrowseCategory } from "@/lib/warframe"

type BuildsSearch = {
  page?: number
  sort?: BuildListSort
  q?: string
  category?: BrowseCategory
  hasGuide?: boolean
  hasShards?: boolean
}

export const Route = createFileRoute("/builds/")({
  validateSearch: (search): BuildsSearch => parseBuildsListSearch(search),
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "newest"),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(publicBuildsQuery(deps)),
  component: BuildsIndexPage,
})

function BuildsIndexPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-6 py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading builds…</p>}
          >
            <BuildsIndexContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function BuildsIndexContent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const page = search.page ?? 1
  const sort = search.sort ?? "newest"
  const q = search.q ?? ""
  const category = search.category
  const hasGuide = search.hasGuide === true
  const hasShards = search.hasShards === true

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "newest"), replace: true })

  return (
    <BuildsListView
      title="Community Builds"
      description="Discover builds created by the community."
      query={publicBuildsQuery({
        page,
        sort,
        q: q || undefined,
        category,
        hasGuide: hasGuide || undefined,
        hasShards: hasShards || undefined,
      })}
      page={page}
      sort={sort}
      q={q}
      category={category}
      hasGuide={hasGuide}
      hasShards={hasShards}
      onUpdateSearch={onUpdateSearch}
      showFilters
      emptyState={
        <>
          <p className="text-muted-foreground">No builds match.</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Try a different search, or head to{" "}
            <Link
              to="/browse"
              search={{ category: "warframes" }}
              className="text-primary underline"
            >
              Browse
            </Link>{" "}
            to publish one.
          </p>
        </>
      }
    />
  )
}
