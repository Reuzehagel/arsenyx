import { createFileRoute, Link } from "@tanstack/react-router"
import { Bookmark } from "lucide-react"

import { BuildsEmptyState } from "@/components/builds/builds-empty-state"
import { buildsListRoute } from "@/components/builds/builds-list-route"
import { BuildsListView } from "@/components/builds/builds-list-view"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth-guards"
import { bookmarkedBuildsQuery } from "@/lib/queries/builds-list-query"
import { pageSeo } from "@/lib/seo"

const list = buildsListRoute("newest")

export const Route = createFileRoute("/_app/bookmarks")({
  head: () => pageSeo("/bookmarks"),
  beforeLoad: () => requireUser(),
  ...list.routeOptions,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(bookmarkedBuildsQuery(deps)),
  component: BookmarksPage,
})

function BookmarksPage() {
  const { params, onUpdateSearch } = list.useListSearch(Route.useSearch())

  return (
    <>
      <div className="wrap flex flex-col gap-6 py-6">
        <BuildsListView
          title="My Bookmarks"
          description="Builds you've bookmarked."
          query={bookmarkedBuildsQuery(params)}
          params={params}
          onUpdateSearch={onUpdateSearch}
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
    </>
  )
}
