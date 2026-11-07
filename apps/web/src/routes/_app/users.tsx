import type { ProfileDirectoryItem } from "@arsenyx/shared/api/users"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { DirectoryGrid, DirectoryPage } from "@/components/directory-page"
import { Link } from "@/components/link"
import { ProfileBadges } from "@/components/profile-badges"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { useProfilesFixture } from "@/dev/fixtures"
import { profilesDirectoryQuery } from "@/lib/queries/profile-query"
import { pageSeo } from "@/lib/seo"
import {
  parseDirectorySearch,
  type DirectorySearchParams,
} from "@/lib/util/directory-search"
import { authorName } from "@/lib/util/user-display"

export const Route = createFileRoute("/_app/users")({
  head: () => pageSeo("/users"),
  validateSearch: parseDirectorySearch,
  loaderDeps: ({ search }): DirectorySearchParams => ({
    page: search.page ?? 1,
    q: search.q,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      profilesDirectoryQuery(deps.page ?? 1, deps.q),
    ),
  component: ProfilesDirectoryPage,
})

function ProfilesDirectoryPage() {
  return (
    <DirectoryPage
      path="/users"
      search={Route.useSearch()}
      title="Profiles"
      description="Build authors on Arsenyx. Search by display name or username."
      noun="profiles"
    >
      <Results />
    </DirectoryPage>
  )
}

function Results() {
  const search = Route.useSearch()
  const data = useProfilesFixture(
    useSuspenseQuery(profilesDirectoryQuery(search.page ?? 1, search.q)).data,
  )
  return (
    <DirectoryGrid
      path="/users"
      search={search}
      noun="profiles"
      emptyMessage="No profiles yet. Publish a build to show up here."
      items={data.users}
      total={data.total}
      limit={data.limit}
      renderItem={(user) => (
        <ProfileCard user={user} showBio={data.users.some((u) => u.bio)} />
      )}
    />
  )
}

function ProfileCard({
  user,
  showBio,
}: {
  user: ProfileDirectoryItem
  /** Any card on this page has a bio — reserve the slot on all of them. */
  showBio: boolean
}) {
  // The directory only lists users that have a username (the API filters the
  // rest out), so the profile link is always resolvable.
  const handle = user.username ?? ""
  const title = authorName(user)

  return (
    <Link
      href={`/profile/${handle}`}
      className="focus-visible:ring-ring ease-snappy block h-full rounded-xl transition-[scale] duration-150 focus:outline-none focus-visible:ring-2 active:scale-[0.98] motion-reduce:active:scale-100"
    >
      <Card className="hover:bg-muted/30 h-full transition-colors">
        <CardHeader className="flex flex-row items-center gap-3">
          <UserAvatar src={user.image} fallback={title} size={10} />
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate" title={title}>
              {title}
            </CardTitle>
            {/* Badge shares the handle line so every header is the same height. */}
            <div className="flex min-w-0 items-center gap-2">
              <p className="text-muted-foreground min-w-0 truncate text-xs">
                @{handle}
              </p>
              <ProfileBadges badges={user.badges} compact />
            </div>
          </div>
        </CardHeader>
        {/* Fixed two-line slot, filled either way when any card on the page has
            a bio, so all cards are the same height with no empty gap. */}
        {showBio ? (
          <CardContent>
            <p
              className={`line-clamp-2 min-h-10 text-sm wrap-anywhere ${user.bio ? "text-muted-foreground" : "text-muted-foreground/60 italic"}`}
            >
              {user.bio ?? "No bio yet."}
            </p>
          </CardContent>
        ) : null}
        <CardFooter className="text-muted-foreground mt-auto justify-between text-xs">
          <span>
            <span className="text-foreground font-semibold tabular-nums">
              {user.buildCount.toLocaleString()}
            </span>{" "}
            {user.buildCount === 1 ? "build" : "builds"}
          </span>
          <span>
            Joined{" "}
            {new Date(user.joinedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
            })}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
