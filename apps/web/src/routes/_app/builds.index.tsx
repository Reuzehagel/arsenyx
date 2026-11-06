import { createFileRoute, Link } from "@tanstack/react-router"
import { Compass } from "lucide-react"

import { BuildsEmptyState } from "@/components/builds/builds-empty-state"
import { buildsListRoute } from "@/components/builds/builds-list-route"
import { BuildsListView } from "@/components/builds/builds-list-view"
import { Button } from "@/components/ui/button"
import { publicBuildsQuery } from "@/lib/queries/builds-list-query"
import { pageSeo } from "@/lib/seo"

const list = buildsListRoute("updated")

export const Route = createFileRoute("/_app/builds/")({
  ...list.routeOptions,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(publicBuildsQuery(deps)),
  head: () => pageSeo("/builds"),
  component: BuildsIndexPage,
})

function BuildsIndexPage() {
  const { params, onUpdateSearch } = list.useListSearch(Route.useSearch())

  return (
    <>
      <div className="wrap flex flex-col gap-6 py-6">
        <BuildsListView
          title="Community Builds"
          description="Discover builds created by the community."
          query={publicBuildsQuery(params)}
          params={params}
          onUpdateSearch={onUpdateSearch}
          emptyState={
            <BuildsEmptyState
              icon={Compass}
              title="No community builds yet"
              description="Be the first to publish one for everyone to find."
              action={
                <Button
                  nativeButton={false}
                  render={
                    <Link to="/browse" search={{ category: "warframes" }} />
                  }
                >
                  Create a build
                </Button>
              }
            />
          }
        />
      </div>
    </>
  )
}
