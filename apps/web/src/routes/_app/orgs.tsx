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
import { useOrgsFixture } from "@/dev/fixtures"
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
  const data = useOrgsFixture(
    useSuspenseQuery(orgsDirectoryQuery(search.page ?? 1, search.q)).data,
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
      renderItem={(org) => (
        <OrgCard
          org={org}
          showDescription={data.orgs.some((o) => o.description)}
        />
      )}
    />
  )
}

function OrgCard({
  org,
  showDescription,
}: {
  org: OrgDirectoryItem
  /** Any card on this page has a description — reserve the slot on all. */
  showDescription: boolean
}) {
  return (
    <Link
      href={`/org/${org.slug}`}
      className="focus-visible:ring-ring ease-snappy block h-full rounded-xl transition-[scale] duration-150 focus:outline-none focus-visible:ring-2 active:scale-[0.98] motion-reduce:active:scale-100"
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
              title={
                org.verified ? `${org.name} · Verified organization` : org.name
              }
            >
              {org.name}
            </CardTitle>
            <CardDescription className="truncate text-xs">
              @{org.slug}
            </CardDescription>
          </div>
        </CardHeader>
        {/* Fixed two-line slot, filled either way when any card on the page has
            text, so all cards are the same height with no empty gap. */}
        {showDescription ? (
          <CardContent>
            <p
              className={`line-clamp-2 min-h-10 text-sm wrap-anywhere ${org.description ? "text-muted-foreground" : "text-muted-foreground/60 italic"}`}
            >
              {org.description ?? "No description yet."}
            </p>
          </CardContent>
        ) : null}
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
