import { LIST_DEFAULT_SORTS } from "@arsenyx/shared/api/build-list"
import type {
  Profile,
  ProfileDirectoryItem,
  ProfileOrg,
  ProfileStats,
} from "@arsenyx/shared/api/users"
import { Hono } from "hono"

import { prisma, sql } from "../db"
import { Prisma } from "../generated/prisma/client"
import { edgeCache } from "../lib/edge-cache"
import { enforceAnonSearchLimit } from "../middleware/rate-limit"
import { BUILD_USER_SELECT, parseListQuery, runList } from "./_build-list"
import { AUTHORED_PUBLIC_BUILD, userPublicScope } from "./_build-visibility"
import { directoryPage, directoryQuery, matchAny } from "./_query"
import { LIST_TTL } from "./builds"

export const users = new Hono()

const DIRECTORY_PAGE = 20

/** The user columns behind a public profile card. The SQL column list below
 *  is generated from these keys (compile-time literals), so the plain-SQL
 *  profile read and the Prisma directory read can't drift. */
const PROFILE_SELECT = {
  ...BUILD_USER_SELECT,
  bio: true,
  createdAt: true,
  isVerified: true,
  isCommunityLeader: true,
  isModerator: true,
  isAdmin: true,
} as const

type ProfileRow = Prisma.UserGetPayload<{ select: typeof PROFILE_SELECT }>

const PROFILE_COLUMNS_SQL = Prisma.raw(
  Object.keys(PROFILE_SELECT)
    .map((k) => `"${k}"`)
    .join(", "),
)

function toProfileCard(u: ProfileRow) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    displayUsername: u.displayUsername,
    image: u.image,
    bio: u.bio,
    joinedAt: u.createdAt.toISOString(),
    badges: {
      verified: u.isVerified,
      communityLeader: u.isCommunityLeader,
      moderator: u.isModerator,
      admin: u.isAdmin,
    },
  }
}

// Public profile directory. Lives on the router root rather than a named
// sibling like /users/public: `username` has no reserved-word list of its own
// (see RESERVED_USERNAMES in auth.ts — "public" isn't in it), so any named
// path here would shadow a real profile that happens to hold that handle.
// The root path can't collide with /:username at all.
// Edge-cached like GET /builds: a miss builds a PrismaClient and runs the
// heaviest app query in prod (an author count per user), and a new author
// showing up a couple of minutes late is fine.
users.get("/", edgeCache({ maxAge: LIST_TTL }), async (c) => {
  const dir = directoryQuery(c, DIRECTORY_PAGE)

  // Only charge the tighter search bucket when a query is actually present —
  // plain directory paging stays on the ANON_READ_LIMITER the router applies.
  if (dir.q) {
    const blocked = await enforceAnonSearchLimit(c, "/users?q=")
    if (blocked) return blocked
  }

  // Banned users 404 on the profile route, so they must not appear here
  // either. A null username means the account never finished handle setup and
  // has no profile URL to link to.
  //
  // The directory lists build *authors*, not every account — that's what the
  // page says it is, and an account with nothing published is a card that
  // leads to an empty profile. `AUTHORED_PUBLIC_BUILD` rather than a plain
  // visibility check so this agrees with what the profile page lists: a user
  // whose only builds are `hideAuthor` org builds has nothing on their profile
  // and doesn't belong here either.
  //
  // This applies to search too, not just paging. A directory whose results
  // change population depending on whether you typed would need its empty
  // state to explain itself; `/profile/<username>` remains the direct route to
  // anyone, published or not.
  const where: Prisma.UserWhereInput = {
    isBanned: false,
    username: { not: null },
    builds: { some: AUTHORED_PUBLIC_BUILD },
    ...matchAny(dir.q, ["username", "displayUsername", "name"]),
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      // Mirrors the org directory's ordering: trusted accounts lead, then
      // newest first within each tier.
      orderBy: [
        { isVerified: "desc" },
        { isCommunityLeader: "desc" },
        { createdAt: "desc" },
      ],
      skip: dir.skip,
      take: dir.limit,
      select: {
        ...PROFILE_SELECT,
        // Same predicate as the `some` filter above and as the profile
        // page's own aggregate, so a card's count matches the profile it
        // links to. Every listed user therefore has a count of at least 1.
        _count: { select: { builds: { where: AUTHORED_PUBLIC_BUILD } } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const items = rows.map((u): ProfileDirectoryItem => ({
    ...toProfileCard(u),
    buildCount: u._count.builds,
  }))
  return c.json(directoryPage("users", items, total, dir))
})

users.get("/:username", async (c) => {
  const username = c.req.param("username").toLowerCase()
  if (!username || username.length > 64) {
    return c.json({ error: "invalid_username" }, 400)
  }

  // Plain SQL rather than Prisma: no PrismaClient is built for a profile read.
  const [user] = await sql<ProfileRow & { isBanned: boolean }>(Prisma.sql`
    SELECT ${PROFILE_COLUMNS_SQL}, "isBanned" FROM users WHERE username = ${username}
  `)
  if (!user || user.isBanned) return c.json({ error: "not_found" }, 404)

  // Sequential, not Promise.all: one connection beats a second connect.
  const [agg] = await sql<ProfileStats>(Prisma.sql`
    SELECT COUNT(*)::int AS "buildCount",
      COALESCE(SUM("likeCount"), 0)::int AS "totalLikes",
      COALESCE(SUM("bookmarkCount"), 0)::int AS "totalBookmarks",
      COALESCE(SUM("viewCount"), 0)::int AS "totalViews"
    FROM builds WHERE ${userPublicScope(user.id).baseFilter}
  `)
  const orgs = await sql<ProfileOrg>(Prisma.sql`
    SELECT o.id, o.name, o.slug, o.image, o.verified, m.role
    FROM organization_members m
    JOIN organizations o ON o.id = m."organizationId"
    WHERE m."userId" = ${user.id}
    ORDER BY m."joinedAt" ASC
  `)

  return c.json({
    ...toProfileCard(user),
    stats: agg,
    orgs,
  } satisfies Profile)
})

users.get("/:username/builds", async (c) => {
  const username = c.req.param("username").toLowerCase()
  const [user] = await sql<{ id: string; isBanned: boolean }>(Prisma.sql`
    SELECT id, "isBanned" FROM users WHERE username = ${username}
  `)
  if (!user || user.isBanned) return c.json({ error: "not_found" }, 404)

  const result = await runList({
    filters: parseListQuery(c),
    ...userPublicScope(user.id),
    defaultSort: LIST_DEFAULT_SORTS.user,
  })
  return c.json(result)
})
