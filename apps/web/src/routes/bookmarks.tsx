import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"

import {
  BuildsListView,
  buildsListLoaderDeps,
  nextBuildsListSearch,
  parseBuildsListSearch,
  type BuildsListSearch,
} from "@/components/builds/builds-list-view"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { requireUser } from "@/lib/auth-guards"
import { bookmarkedBuildsQuery } from "@/lib/queries/builds-list-query"

export const Route = createFileRoute("/bookmarks")({
  validateSearch: (search): BuildsListSearch => parseBuildsListSearch(search),
  beforeLoad: () => requireUser(),
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "newest"),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(bookmarkedBuildsQuery(deps)),
  component: BookmarksPage,
})

function BookmarksPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const params = buildsListLoaderDeps(search, "newest")

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "newest"), replace: true })

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-6 py-6">
          <BuildsListView
            title="My Bookmarks"
            description="Builds you've bookmarked."
            query={bookmarkedBuildsQuery(params)}
            params={params}
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
        </div>
      </main>
      <Footer />
    </div>
  )
}
