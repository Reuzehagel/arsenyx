import type { OrgProfile } from "@arsenyx/shared/api/orgs"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Settings } from "lucide-react"

import { buildsListRoute } from "@/components/builds/builds-list-route"
import { BuildsListView } from "@/components/builds/builds-list-view"
import { DelayedSuspense } from "@/components/delayed-fallback"
import { EntityHeader } from "@/components/entity-header"
import { Link } from "@/components/link"
import { RouteNotFound } from "@/components/route-not-found"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { orgBuildsQuery, orgQuery } from "@/lib/queries/org-query"
import { seo } from "@/lib/seo"
import { authorName } from "@/lib/util/user-display"

const list = buildsListRoute("newest")

export const Route = createFileRoute("/_app/org/$slug")({
  ...list.routeOptions,
  loader: async ({ context, params, deps }) => {
    const [org] = await Promise.all([
      context.queryClient.ensureQueryData(orgQuery(params.slug)),
      context.queryClient.ensureQueryData(orgBuildsQuery(params.slug, deps)),
    ])
    return org
  },
  head: ({ loaderData, params }) =>
    seo({
      title: loaderData ? `${loaderData.name} — Organization` : undefined,
      description:
        loaderData?.description ??
        `Warframe builds published by ${loaderData?.name ?? "this organization"} on Arsenyx.`,
      canonicalPath: `/org/${params.slug}`,
      image: loaderData?.image ?? undefined,
    }),
  component: OrgPage,
  notFoundComponent: OrgNotFound,
})

function OrgPage() {
  return (
    <>
      <div className="wrap flex flex-col gap-6 py-6">
        <DelayedSuspense
          fallback={
            <p className="text-muted-foreground">Loading organization…</p>
          }
        >
          <OrgContent />
        </DelayedSuspense>
      </div>
    </>
  )
}

function OrgContent() {
  const { slug } = Route.useParams()
  const { params, onUpdateSearch } = list.useListSearch(Route.useSearch())

  const { data: org } = useSuspenseQuery(orgQuery(slug))

  return (
    <>
      <OrgHeader org={org} />
      <OrgMembers org={org} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Builds</h2>
        <BuildsListView
          query={orgBuildsQuery(slug, params)}
          params={params}
          onUpdateSearch={onUpdateSearch}
          emptyState={
            <p className="text-muted-foreground">
              No public builds yet under this organization.
            </p>
          }
        />
      </section>
    </>
  )
}

function OrgHeader({ org }: { org: OrgProfile }) {
  return (
    <EntityHeader
      avatar={
        <UserAvatar
          src={org.image}
          fallback={org.name}
          size={20}
          shape="square"
        />
      }
      name={org.name}
      nameExtras={
        <>
          <span
            className={`shrink-0 rounded px-[5px] py-[1px] text-[10px] font-semibold ${
              org.verified
                ? "bg-[#7c3aed] text-white"
                : "bg-muted text-muted-foreground"
            }`}
            title={org.verified ? "Verified organization" : undefined}
          >
            ORG
          </span>
          <span className="text-muted-foreground text-sm">@{org.slug}</span>
        </>
      }
      bio={org.description}
      dateLabel="Created"
      date={org.createdAt}
      stats={[
        { label: "Members", value: org.members.length },
        { label: "Public builds", value: org.buildCount },
      ]}
      action={
        org.viewer.isAdmin ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/org/${org.slug}/settings`} />}
            nativeButton={false}
            className="cursor-default"
          >
            <Settings data-icon="inline-start" />
            Settings
          </Button>
        ) : null
      }
    />
  )
}

function OrgMembers({ org }: { org: OrgProfile }) {
  if (org.members.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Members</h2>
      <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {org.members.map((m) => {
          const label = authorName(m.user, "Member")
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

function OrgNotFound() {
  return (
    <RouteNotFound
      title="Organization not found"
      message="This organization may not exist or has been deleted."
    />
  )
}
