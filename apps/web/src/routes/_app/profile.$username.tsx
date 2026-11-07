import type { Profile } from "@arsenyx/shared/api/users"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { buildsListRoute } from "@/components/builds/builds-list-route"
import { BuildsListView } from "@/components/builds/builds-list-view"
import { DelayedSuspense } from "@/components/delayed-fallback"
import { EntityHeader } from "@/components/entity-header"
import { Link } from "@/components/link"
import { ProfileBadges } from "@/components/profile-badges"
import { RouteNotFound } from "@/components/route-not-found"
import { UserAvatar } from "@/components/user-avatar"
import { profileBuildsQuery, profileQuery } from "@/lib/queries/profile-query"
import { seo } from "@/lib/seo"
import { authorName } from "@/lib/util/user-display"

const list = buildsListRoute("newest")

export const Route = createFileRoute("/_app/profile/$username")({
  ...list.routeOptions,
  loader: async ({ context, params, deps }) => {
    const [profile] = await Promise.all([
      context.queryClient.ensureQueryData(profileQuery(params.username)),
      context.queryClient.ensureQueryData(
        profileBuildsQuery(params.username, deps),
      ),
    ])
    return profile
  },
  head: ({ loaderData, params }) => {
    const name = loaderData
      ? authorName(loaderData, params.username)
      : params.username
    return seo({
      title: `${name}'s Builds`,
      description:
        loaderData?.bio ?? `Warframe builds shared by ${name} on Arsenyx.`,
      canonicalPath: `/profile/${params.username}`,
      image: loaderData?.image ?? undefined,
    })
  },
  component: ProfilePage,
  notFoundComponent: ProfileNotFound,
})

function ProfilePage() {
  return (
    <>
      <div className="wrap flex flex-col gap-6 py-6">
        <DelayedSuspense
          fallback={<p className="text-muted-foreground">Loading profile…</p>}
        >
          <ProfileContent />
        </DelayedSuspense>
      </div>
    </>
  )
}

function ProfileContent() {
  const { username } = Route.useParams()
  const { params, onUpdateSearch } = list.useListSearch(Route.useSearch())

  const { data: profile } = useSuspenseQuery(profileQuery(username))

  return (
    <>
      <ProfileHeader profile={profile} />
      <BuildsListView
        title="Public builds"
        description={`Builds shared by ${authorName(profile, "this user")}.`}
        query={profileBuildsQuery(username, params)}
        params={params}
        onUpdateSearch={onUpdateSearch}
        emptyState={
          <p className="text-muted-foreground">No public builds yet.</p>
        }
      />
    </>
  )
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const display = authorName(profile, "User")
  return (
    <EntityHeader
      avatar={<UserAvatar src={profile.image} fallback={display} size={20} />}
      name={display}
      nameExtras={
        <>
          {profile.username ? (
            <span className="text-muted-foreground text-sm">
              @{profile.username}
            </span>
          ) : null}
          <ProfileBadges badges={profile.badges} />
        </>
      }
      bio={profile.bio}
      dateLabel="Joined"
      date={profile.joinedAt}
      stats={[
        { label: "Builds", value: profile.stats.buildCount },
        { label: "Likes", value: profile.stats.totalLikes },
        { label: "Bookmarks", value: profile.stats.totalBookmarks },
        { label: "Views", value: profile.stats.totalViews },
      ]}
    >
      <ProfileOrgs orgs={profile.orgs} />
    </EntityHeader>
  )
}

function ProfileOrgs({ orgs }: { orgs: Profile["orgs"] }) {
  // ?? [] guards the deploy-skew window where the web Worker ships before
  // the API Worker and cached responses lack the orgs field.
  const items = orgs ?? []
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((org) => (
        <Link
          key={org.id}
          href={`/org/${org.slug}`}
          className="bg-muted/50 hover:bg-muted flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 text-xs transition-colors"
          title={org.verified ? "Verified organization" : undefined}
        >
          <UserAvatar
            src={org.image}
            fallback={org.name}
            size={4}
            shape="rounded"
          />
          <span
            className={`max-w-40 truncate font-medium ${org.verified ? "text-wf-org" : ""}`}
          >
            {org.name}
          </span>
        </Link>
      ))}
    </div>
  )
}

function ProfileNotFound() {
  return (
    <RouteNotFound
      title="User not found"
      message="This profile may not exist or has been deleted."
    />
  )
}
