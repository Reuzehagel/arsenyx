import { Hono } from "hono"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { BuildVisibility } from "../generated/prisma/enums"
import { parseListQuery, runList } from "./_build-list"

export const users = new Hono()

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

  const [buildCount, agg] = await Promise.all([
    prisma.build.count({
      where: { userId: user.id, visibility: BuildVisibility.PUBLIC },
    }),
    prisma.build.aggregate({
      where: { userId: user.id, visibility: BuildVisibility.PUBLIC },
      _sum: { likeCount: true, bookmarkCount: true, viewCount: true },
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
      buildCount,
      totalLikes: agg._sum.likeCount ?? 0,
      totalBookmarks: agg._sum.bookmarkCount ?? 0,
      totalViews: agg._sum.viewCount ?? 0,
    },
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
    baseWhere: { userId: user.id, visibility: BuildVisibility.PUBLIC },
    baseFilter: Prisma.sql`"userId" = ${user.id} AND visibility = 'PUBLIC'`,
    defaultSort: "newest",
  })
  return c.json(result)
})
