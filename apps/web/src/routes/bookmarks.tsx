import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Bookmark } from "lucide-react"

import { BuildsEmptyState } from "@/components/builds/builds-empty-state"
import {
  BuildsListView,
  buildsListLoaderDeps,
  nextBuildsListSearch,
  parseBuildsListSearch,
  type BuildsListSearch,
} from "@/components/builds/builds-list-view"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth-guards"
import { bookmarkedBuildsQuery } from "@/lib/queries/builds-list-query"
import { seo } from "@/lib/seo"

export const Route = createFileRoute("/bookmarks")({
  head: () => seo({ title: "Bookmarks", noindex: true }),
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
              <BuildsEmptyState
                icon={Bookmark}
                title="No bookmarks yet"
                description="Tap the bookmark icon on any build to save it here for later."
                action={
                  <Button nativeButton={false} render={<Link to="/builds" />}>
                    Browse community builds
                  </Button>
                }
              />
            }
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
