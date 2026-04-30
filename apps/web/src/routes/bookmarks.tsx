import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
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
import { authClient } from "@/lib/auth-client"
import {
  bookmarkedBuildsQuery,
  type BuildListSort,
} from "@/lib/builds-list-query"
import { type BrowseCategory } from "@/lib/warframe"

type BookmarksSearch = {
  page?: number
  sort?: BuildListSort
  q?: string
  category?: BrowseCategory
  hasGuide?: boolean
  hasShards?: boolean
}

export const Route = createFileRoute("/bookmarks")({
  validateSearch: (search): BookmarksSearch => parseBuildsListSearch(search),
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data?.user) {
      throw redirect({ to: "/auth/signin" })
    }
  },
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "newest"),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(bookmarkedBuildsQuery(deps)),
  component: BookmarksPage,
})

function BookmarksPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-6 py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading builds…</p>}
          >
            <BookmarksContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function BookmarksContent() {
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
      title="My Bookmarks"
      description="Builds you've bookmarked."
      query={bookmarkedBuildsQuery({
        page,
        sort,
        q,
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
          <p className="text-muted-foreground">
            You haven't bookmarked any builds yet.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            Browse{" "}
            <Link to="/builds" className="text-primary underline">
              public builds
            </Link>{" "}
            and tap the bookmark icon to save them here.
          </p>
        </>
      }
    />
  )
}
