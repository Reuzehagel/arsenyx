import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
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
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/user-avatar"
import { type BuildListSort } from "@/lib/builds-list-query"
import {
  profileBuildsQuery,
  profileQuery,
  type Profile,
} from "@/lib/profile-query"
import { type BrowseCategory } from "@/lib/warframe"

type ProfileSearch = {
  page?: number
  sort?: BuildListSort
  q?: string
  category?: BrowseCategory
  hasGuide?: boolean
  hasShards?: boolean
}

export const Route = createFileRoute("/profile/$username")({
  validateSearch: (search): ProfileSearch => parseBuildsListSearch(search),
  loaderDeps: ({ search }) => buildsListLoaderDeps(search, "newest"),
  loader: async ({ context, params, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(profileQuery(params.username)),
      context.queryClient.ensureQueryData(
        profileBuildsQuery(params.username, deps),
      ),
    ])
  },
  component: ProfilePage,
  notFoundComponent: ProfileNotFound,
})

function ProfilePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading profile…</p>}
          >
            <ProfileContent />
          </Suspense>
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
  const page = search.page ?? 1
  const sort = search.sort ?? "newest"
  const q = search.q ?? ""
  const category = search.category
  const hasGuide = search.hasGuide === true
  const hasShards = search.hasShards === true

  const { data: profile } = useSuspenseQuery(profileQuery(username))

  const onUpdateSearch = (next: BuildsListSearch) =>
    navigate({ search: nextBuildsListSearch(next, "newest"), replace: true })

  return (
    <>
      <ProfileHeader profile={profile} />
      <Suspense
        fallback={<p className="text-muted-foreground">Loading builds…</p>}
      >
        <BuildsListView
          title="Public builds"
          description={`Builds shared by ${profile.displayUsername ?? profile.username ?? "this user"}.`}
          query={profileBuildsQuery(username, {
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
            <p className="text-muted-foreground">No public builds yet.</p>
          }
        />
      </Suspense>
    </>
  )
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const display =
    profile.displayUsername ?? profile.username ?? profile.name ?? "User"
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

function ProfileBadges({ badges }: { badges: Profile["badges"] }) {
  const items: { label: string; className: string }[] = []
  if (badges.admin) {
    items.push({ label: "Admin", className: "bg-red-500/15 text-red-500" })
  }
  if (badges.moderator) {
    items.push({
      label: "Moderator",
      className: "bg-blue-500/15 text-blue-500",
    })
  }
  if (badges.communityLeader) {
    items.push({
      label: "Community Leader",
      className: "bg-amber-500/15 text-amber-500",
    })
  }
  if (badges.verified) {
    items.push({
      label: "Verified",
      className: "bg-emerald-500/15 text-emerald-500",
    })
  }
  if (items.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((b) => (
        <Badge
          key={b.label}
          variant="secondary"
          className={`${b.className} px-2 py-0.5 text-xs`}
        >
          {b.label}
        </Badge>
      ))}
    </span>
  )
}

function ProfileNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="container flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <h1 className="text-2xl font-semibold">User not found</h1>
        <p className="text-muted-foreground">
          This profile may not exist or has been deleted.
        </p>
      </main>
      <Footer />
    </div>
  )
}
