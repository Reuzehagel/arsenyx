import type { OrgDirectoryItem } from "@arsenyx/shared/api/orgs"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { DirectoryGrid, DirectoryPage } from "@/components/directory-page"
import { Link } from "@/components/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { orgsDirectoryQuery } from "@/lib/queries/org-query"
import { pageSeo } from "@/lib/seo"
import {
  parseDirectorySearch,
  type DirectorySearchParams,
} from "@/lib/util/directory-search"

export const Route = createFileRoute("/_app/orgs")({
  head: () => pageSeo("/orgs"),
  validateSearch: parseDirectorySearch,
  loaderDeps: ({ search }): DirectorySearchParams => ({
    page: search.page ?? 1,
    q: search.q,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      orgsDirectoryQuery(deps.page ?? 1, deps.q),
    ),
  component: OrgsDirectoryPage,
})

function OrgsDirectoryPage() {
  return (
    <DirectoryPage
      path="/orgs"
      search={Route.useSearch()}
      title="Organizations"
      description="Communities on Arsenyx. Browse their public builds — joining is invite-only."
      noun="organizations"
    >
      <Results />
    </DirectoryPage>
  )
}

function Results() {
  const search = Route.useSearch()
  const { data } = useSuspenseQuery(
    orgsDirectoryQuery(search.page ?? 1, search.q),
  )
  return (
    <DirectoryGrid
      path="/orgs"
      search={search}
      noun="organizations"
      emptyMessage="No organizations yet. Be the first to create one."
      items={data.orgs}
      total={data.total}
      limit={data.limit}
      renderItem={(org) => <OrgCard org={org} />}
    />
  )
}

function OrgCard({ org }: { org: OrgDirectoryItem }) {
  return (
    <Link
      href={`/org/${org.slug}`}
      className="focus-visible:ring-ring block h-full rounded-xl focus:outline-none focus-visible:ring-2"
    >
      <Card className="hover:bg-muted/30 h-full transition-colors">
        <CardHeader className="flex flex-row items-center gap-3">
          <UserAvatar
            src={org.image}
            fallback={org.name}
            size={10}
            shape="square"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <CardTitle
              className={`truncate ${org.verified ? "text-wf-org" : ""}`}
              title={org.verified ? "Verified organization" : undefined}
            >
              {org.name}
            </CardTitle>
            <CardDescription className="truncate text-xs">
              @{org.slug}
            </CardDescription>
          </div>
        </CardHeader>
        {org.description ? (
          <CardContent>
            <p className="text-muted-foreground line-clamp-3 text-sm">
              {org.description}
            </p>
          </CardContent>
        ) : null}
        {/* mt-auto pins the stats row to the card bottom so rows align
            across cards with and without a description. */}
        <CardFooter className="text-muted-foreground mt-auto justify-between text-xs">
          <span>
            <span className="text-foreground font-semibold tabular-nums">
              {org.memberCount.toLocaleString()}
            </span>{" "}
            {org.memberCount === 1 ? "member" : "members"}
          </span>
          <span>
            <span className="text-foreground font-semibold tabular-nums">
              {org.buildCount.toLocaleString()}
            </span>{" "}
            {org.buildCount === 1 ? "build" : "builds"}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
