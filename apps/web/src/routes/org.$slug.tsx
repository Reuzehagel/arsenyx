import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Settings } from "lucide-react"
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
import { Link } from "@/components/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { type BuildListSort } from "@/lib/builds-list-query"
import { orgBuildsQuery, orgQuery, type OrgProfile } from "@/lib/org-query"
import { type BrowseCategory } from "@/lib/warframe"

type OrgSearch = {
  page?: number
  sort?: BuildListSort
  q?: string
  category?: BrowseCategory
  hasGuide?: boolean
  hasShards?: boolean
}

export const Route = createFileRoute("/org/$slug")({
  validateSearch: (search): OrgSearch => parseBuildsListSearch(search),
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "newest"),
  loader: async ({ context, params, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(orgQuery(params.slug)),
      context.queryClient.ensureQueryData(orgBuildsQuery(params.slug, deps)),
    ])
  },
  component: OrgPage,
  notFoundComponent: OrgNotFound,
})

function OrgPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-6 py-6">
          <Suspense
            fallback={
              <p className="text-muted-foreground">Loading organization…</p>
            }
          >
            <OrgContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function OrgContent() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const page = search.page ?? 1
  const sort = search.sort ?? "newest"
  const q = search.q ?? ""
  const category = search.category
  const hasGuide = search.hasGuide === true
  const hasShards = search.hasShards === true

  const { data: org } = useSuspenseQuery(orgQuery(slug))

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "newest"), replace: true })

  return (
    <>
      <OrgHeader org={org} />
      <OrgMembers org={org} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Builds</h2>
        <Suspense
          fallback={<p className="text-muted-foreground">Loading builds…</p>}
        >
          <BuildsListView
            query={orgBuildsQuery(slug, {
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
              <p className="text-muted-foreground">
                No public builds yet under this organization.
              </p>
            }
          />
        </Suspense>
      </section>
    </>
  )
}

function OrgHeader({ org }: { org: OrgProfile }) {
  const created = new Date(org.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  })

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
      <UserAvatar
        src={org.image}
        fallback={org.name}
        size={20}
        shape="square"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {org.name}
          </h1>
          <span className="shrink-0 rounded bg-[#7c3aed] px-[5px] py-[1px] text-[10px] font-semibold text-white">
            ORG
          </span>
          <span className="text-muted-foreground text-sm">@{org.slug}</span>
        </div>
        {org.description ? <p className="text-sm">{org.description}</p> : null}
        <span className="text-muted-foreground text-xs">Created {created}</span>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-4 text-sm">
          <Stat label="Members" value={org.members.length} />
          <Stat label="Public builds" value={org.buildCount} />
        </div>
      </div>
      {org.viewer.isAdmin ? (
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/org/${org.slug}/settings`} />}
          nativeButton={false}
        >
          <Settings className="size-4" />
          Settings
        </Button>
      ) : null}
    </div>
  )
}

function OrgMembers({ org }: { org: OrgProfile }) {
  if (org.members.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Members</h2>
      <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {org.members.map((m) => {
          const label =
            m.user.displayUsername ?? m.user.name ?? m.user.username ?? "Member"
          const cardContent = (
            <>
              <UserAvatar src={m.user.image} fallback={label} size={7} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {label}
              </span>
              {m.role === "ADMIN" ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  Admin
                </Badge>
              ) : null}
            </>
          )
          const cardClass =
            "bg-card hover:bg-muted/50 flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors"
          return (
            <li key={m.user.id}>
              {m.user.username ? (
                <Link
                  href={`/profile/${m.user.username}`}
                  className={cardClass}
                >
                  {cardContent}
                </Link>
              ) : (
                <div className={cardClass}>{cardContent}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="text-foreground font-semibold tabular-nums">
        {value.toLocaleString()}
      </span>{" "}
      {label}
    </span>
  )
}

function OrgNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <h1 className="text-2xl font-semibold">Organization not found</h1>
        <p className="text-muted-foreground">
          This organization may not exist or has been deleted.
        </p>
      </main>
      <Footer />
    </div>
  )
}
