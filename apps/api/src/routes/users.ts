import { Hono } from "hono"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { enforceAnonSearchLimit } from "../middleware/rate-limit"
import { parseListQuery, runList } from "./_build-list"
import { AUTHORED_PUBLIC_BUILD, userPublicScope } from "./_build-visibility"
import { parsePage, trimQ } from "./_query"

export const users = new Hono()

const DIRECTORY_PAGE = 20

const PROFILE_SELECT = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  image: true,
  bio: true,
  createdAt: true,
  isVerified: true,
  isCommunityLeader: true,
  isModerator: true,
  isAdmin: true,
  isBanned: true,
} as const

// Public profile directory. Lives on the router root rather than a named
// sibling like /users/public: `username` has no reserved-word list of its own
// (see RESERVED_USERNAMES in auth.ts — "public" isn't in it), so any named
// path here would shadow a real profile that happens to hold that handle.
// The root path can't collide with /:username at all.
users.get("/", async (c) => {
  const page = parsePage(c.req.query("page"))
  const q = trimQ(c.req.query("q"))
  const skip = (page - 1) * DIRECTORY_PAGE

  // Only charge the tighter search bucket when a query is actually present —
  // plain directory paging stays on the ANON_READ_LIMITER the router applies.
  if (q) {
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
    ...(q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayUsername: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
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
      skip,
      take: DIRECTORY_PAGE,
      select: {
        id: true,
        name: true,
        username: true,
        displayUsername: true,
        image: true,
        bio: true,
        createdAt: true,
        isVerified: true,
        isCommunityLeader: true,
        isModerator: true,
        isAdmin: true,
        // Same predicate as the `some` filter above and as the profile
        // page's own aggregate, so a card's count matches the profile it
        // links to. Every listed user therefore has a count of at least 1.
        _count: { select: { builds: { where: AUTHORED_PUBLIC_BUILD } } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return c.json({
    users: rows.map((u) => ({
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
      buildCount: u._count.builds,
    })),
    total,
    page,
    limit: DIRECTORY_PAGE,
  })
})

users.get("/:username", async (c) => {
  const username = c.req.param("username").toLowerCase()
  if (!username || username.length > 64) {
    return c.json({ error: "invalid_username" }, 400)
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: PROFILE_SELECT,
  })
  if (!user || user.isBanned) return c.json({ error: "not_found" }, 404)

  const [agg, memberships] = await Promise.all([
    prisma.build.aggregate({
      where: userPublicScope(user.id).baseWhere,
      _count: true,
      _sum: { likeCount: true, bookmarkCount: true, viewCount: true },
    }),
    prisma.organizationMember.findMany({
      relationLoadStrategy: "join",
      where: { userId: user.id },
      orderBy: { joinedAt: "asc" },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            verified: true,
          },
        },
      },
    }),
  ])

  return c.json({
    id: user.id,
    name: user.name,
    username: user.username,
    displayUsername: user.displayUsername,
    image: user.image,
    bio: user.bio,
    joinedAt: user.createdAt.toISOString(),
    badges: {
      verified: user.isVerified,
      communityLeader: user.isCommunityLeader,
      moderator: user.isModerator,
      admin: user.isAdmin,
    },
    stats: {
      buildCount: agg._count,
      totalLikes: agg._sum.likeCount ?? 0,
      totalBookmarks: agg._sum.bookmarkCount ?? 0,
      totalViews: agg._sum.viewCount ?? 0,
    },
    orgs: memberships.map((m) => ({ ...m.organization, role: m.role })),
  })
})

users.get("/:username/builds", async (c) => {
  const username = c.req.param("username").toLowerCase()
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isBanned: true },
  })
  if (!user || user.isBanned) return c.json({ error: "not_found" }, 404)

  const result = await runList({
    filters: parseListQuery(c),
    ...userPublicScope(user.id),
    defaultSort: "newest",
  })
  return c.json(result)
})
