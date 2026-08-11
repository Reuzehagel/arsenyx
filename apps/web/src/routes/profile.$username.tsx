import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import {
  BuildsListView,
  buildsListLoaderDeps,
  nextBuildsListSearch,
  parseBuildsListSearch,
  type BuildsListSearch,
} from "@/components/builds/builds-list-view"
import { DelayedSuspense } from "@/components/delayed-fallback"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
import { ProfileBadges } from "@/components/profile-badges"
import { Stat } from "@/components/profile-stat"
import { RouteNotFound } from "@/components/route-not-found"
import { UserAvatar } from "@/components/user-avatar"
import {
  profileBuildsQuery,
  profileQuery,
  type Profile,
} from "@/lib/queries/profile-query"
import { seo } from "@/lib/seo"
import { authorName } from "@/lib/util/user-display"

export const Route = createFileRoute("/profile/$username")({
  validateSearch: (search): BuildsListSearch => parseBuildsListSearch(search),
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "newest"),
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
      ? (loaderData.displayUsername ?? loaderData.username ?? params.username)
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
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-6 py-6">
          <DelayedSuspense
            fallback={<p className="text-muted-foreground">Loading profile…</p>}
          >
            <ProfileContent />
          </DelayedSuspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function ProfileContent() {
  const { username } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const params = buildsListLoaderDeps(search, "newest")

  const { data: profile } = useSuspenseQuery(profileQuery(username))

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "newest"), replace: true })

  return (
    <>
      <ProfileHeader profile={profile} />
      <BuildsListView
        title="Public builds"
        description={`Builds shared by ${profile.displayUsername ?? profile.username ?? "this user"}.`}
        query={profileBuildsQuery(username, params)}
        params={params}
        onUpdateSearch={onUpdateSearch}
        showFilters
        emptyState={
          <p className="text-muted-foreground">No public builds yet.</p>
        }
      />
    </>
  )
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const display = authorName(profile, "User")
  const handle = profile.username ? `@${profile.username}` : null
  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  })

  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
      <UserAvatar src={profile.image} fallback={display} size={20} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {display}
          </h1>
          {handle ? (
            <span className="text-muted-foreground text-sm">{handle}</span>
          ) : null}
          <ProfileBadges badges={profile.badges} />
        </div>
        {profile.bio ? <p className="text-sm">{profile.bio}</p> : null}
        <ProfileOrgs orgs={profile.orgs} />
        <span className="text-muted-foreground text-xs">Joined {joined}</span>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-4 text-sm">
          <Stat label="Builds" value={profile.stats.buildCount} />
          <Stat label="Likes" value={profile.stats.totalLikes} />
          <Stat label="Bookmarks" value={profile.stats.totalBookmarks} />
          <Stat label="Views" value={profile.stats.totalViews} />
        </div>
      </div>
    </div>
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
