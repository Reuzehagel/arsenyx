import { createFileRoute, Link } from "@tanstack/react-router"
import { Hammer } from "lucide-react"

import { BuildsEmptyState } from "@/components/builds/builds-empty-state"
import { buildsListRoute } from "@/components/builds/builds-list-route"
import { BuildsListView } from "@/components/builds/builds-list-view"
import { Button } from "@/components/ui/button"
import { requireUser } from "@/lib/auth-guards"
import { myBuildsQuery } from "@/lib/queries/builds-list-query"
import { pageSeo } from "@/lib/seo"

const list = buildsListRoute("updated")

export const Route = createFileRoute("/_app/builds/mine")({
  head: () => pageSeo("/builds/mine"),
  beforeLoad: () => requireUser(),
  ...list.routeOptions,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(myBuildsQuery(deps)),
  component: MineBuildsPage,
})

function MineBuildsPage() {
  const { params, onUpdateSearch } = list.useListSearch(Route.useSearch())

  return (
    <>
      <div className="wrap flex flex-col gap-6 py-6">
        <BuildsListView
          title="My Builds"
          description="Builds you've authored."
          query={myBuildsQuery(params)}
          params={params}
          onUpdateSearch={onUpdateSearch}
          emptyState={
            <BuildsEmptyState
              icon={Hammer}
              title="No builds yet"
              description="Builds you create will show up here."
              action={
                <Button
                  nativeButton={false}
                  render={
                    <Link to="/browse" search={{ category: "warframes" }} />
                  }
                >
                  Create your first build
                </Button>
              }
            />
          }
        />
      </div>
    </>
  )
}
