import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"

import { DirectorySearch } from "@/components/directory-search"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
import { Pagination } from "@/components/pagination"
import { ProfileBadges } from "@/components/profile-badges"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import {
  profilesDirectoryQuery,
  type ProfileDirectoryItem,
} from "@/lib/queries/profile-query"
import { seo } from "@/lib/seo"
import {
  parseDirectorySearch,
  type DirectorySearchParams,
} from "@/lib/util/directory-search"
import { authorName } from "@/lib/util/user-display"

export const Route = createFileRoute("/users")({
  head: () =>
    seo({
      title: "Profiles",
      description:
        "Find Warframe build authors on Arsenyx — search profiles by name or username.",
      canonicalPath: "/users",
    }),
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
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex max-w-5xl flex-col gap-8 py-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Profiles</h1>
            <p className="text-muted-foreground text-sm">
              Build authors on Arsenyx. Search by display name or username.
            </p>
          </div>
          <DirectorySearch
            value={search.q ?? ""}
            // A new query invalidates the current page — result 21 of the old
            // query has nothing to do with the new one.
            onSearch={(q) => navigate({ search: q ? { q } : {} })}
            placeholder="Search profiles…"
            label="Search profiles"
          />
          {/* Keyed on the query so a new search shows the fallback instead of
              holding the previous page's rows while the loader resolves. */}
          <Suspense
            key={`${search.q ?? ""}:${search.page ?? 1}`}
            fallback={
              <p className="text-muted-foreground text-sm">Loading profiles…</p>
            }
          >
            <ProfilesDirectoryContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function ProfilesDirectoryContent() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const page = search.page ?? 1
  const q = search.q
  const { data } = useSuspenseQuery(profilesDirectoryQuery(page, q))
  const { users, total, limit } = data

  const goto = (next: number) =>
    navigate({
      search: { ...(q ? { q } : {}), ...(next > 1 ? { page: next } : {}) },
      replace: false,
    })

  if (users.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {q
          ? `No profiles match "${q}".`
          : "No profiles yet. Publish a build to show up here."}
      </p>
    )
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <li key={user.id}>
            <ProfileCard user={user} />
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        total={total}
        limit={limit}
        onPage={goto}
        href={(p) => {
          const params = new URLSearchParams()
          if (q) params.set("q", q)
          if (p > 1) params.set("page", String(p))
          const qs = params.toString()
          return qs ? `/users?${qs}` : "/users"
        }}
      />
    </>
  )
}

function ProfileCard({ user }: { user: ProfileDirectoryItem }) {
  // The directory only lists users that have a username (the API filters the
  // rest out), so the profile link is always resolvable.
  const handle = user.username ?? ""
  const title = authorName(user)

  return (
    <Link
      href={`/profile/${handle}`}
      className="focus-visible:ring-ring block h-full rounded-xl focus:outline-none focus-visible:ring-2"
    >
      <Card className="hover:bg-muted/30 h-full transition-colors">
        <CardHeader className="flex flex-row items-center gap-3">
          <UserAvatar src={user.image} fallback={title} size={10} />
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="truncate">{title}</CardTitle>
            <p className="text-muted-foreground truncate text-xs">@{handle}</p>
            <ProfileBadges badges={user.badges} compact />
          </div>
        </CardHeader>
        {user.bio ? (
          <CardContent>
            <p className="text-muted-foreground line-clamp-3 text-sm">
              {user.bio}
            </p>
          </CardContent>
        ) : null}
        {/* mt-auto pins the stats row to the card bottom so rows align across
            cards with and without a bio. */}
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
