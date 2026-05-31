import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Compass } from "lucide-react"

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
import { publicBuildsQuery } from "@/lib/queries/builds-list-query"

export const Route = createFileRoute("/builds/")({
  validateSearch: (search): BuildsListSearch => parseBuildsListSearch(search),
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "newest"),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(publicBuildsQuery(deps)),
  component: BuildsIndexPage,
})

function BuildsIndexPage() {
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
            title="Community Builds"
            description="Discover builds created by the community."
            query={publicBuildsQuery(params)}
            params={params}
            onUpdateSearch={onUpdateSearch}
            showFilters
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
      </main>
      <Footer />
    </div>
  )
}
