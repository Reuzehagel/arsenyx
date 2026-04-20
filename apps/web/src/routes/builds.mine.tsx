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
import { myBuildsQuery, type BuildListSort } from "@/lib/builds-list-query"
import { type BrowseCategory } from "@/lib/warframe"

type MineSearch = {
  page?: number
  sort?: BuildListSort
  q?: string
  category?: BrowseCategory
  hasGuide?: boolean
  hasShards?: boolean
}

export const Route = createFileRoute("/builds/mine")({
  validateSearch: (search): MineSearch => parseBuildsListSearch(search),
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data?.user) {
      throw redirect({ to: "/auth/signin" })
    }
  },
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "updated"),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(myBuildsQuery(deps)),
  component: MineBuildsPage,
})

function MineBuildsPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading builds…</p>}
          >
            <MineBuildsContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function MineBuildsContent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const page = search.page ?? 1
  const sort = search.sort ?? "updated"
  const q = search.q ?? ""
  const category = search.category
  const hasGuide = search.hasGuide === true
  const hasShards = search.hasShards === true

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "updated"), replace: true })

  return (
    <BuildsListView
      title="My Builds"
      description="Builds you've authored."
      query={myBuildsQuery({
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
  )
}
