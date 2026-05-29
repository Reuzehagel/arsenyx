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
import { myBuildsQuery } from "@/lib/queries/builds-list-query"

export const Route = createFileRoute("/builds/mine")({
  validateSearch: (search): BuildsListSearch => parseBuildsListSearch(search),
  beforeLoad: () => requireUser(),
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "updated"),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(myBuildsQuery(deps)),
  component: MineBuildsPage,
})

function MineBuildsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const params = buildsListLoaderDeps(search, "updated")

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "updated"), replace: true })

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-6 py-6">
          <BuildsListView
            title="My Builds"
            description="Builds you've authored."
            query={myBuildsQuery(params)}
            params={params}
            onUpdateSearch={onUpdateSearch}
            showFilters
            emptyState={
              <>
                <p className="text-muted-foreground">
                  You haven't saved any builds yet.
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Start one from{" "}
                  <Link
                    to="/browse"
                    search={{ category: "warframes" }}
                    className="text-primary underline"
                  >
                    Browse
                  </Link>
                  .
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
