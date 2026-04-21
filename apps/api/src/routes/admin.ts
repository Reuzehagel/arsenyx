import { Hono } from "hono"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { isPrismaNotFound, requireAdmin } from "./_admin"
import { parseListQuery, runList } from "./_build-list"
import { parsePage, trimQ } from "./_query"

export const admin = new Hono()

const USER_FLAGS = [
  "isAdmin",
  "isModerator",
  "isCommunityLeader",
  "isVerified",
  "isBanned",
] as const
type UserFlag = (typeof USER_FLAGS)[number]

const LIST_PAGE = 24

admin.get("/users", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const page = parsePage(c.req.query("page"))
  const q = trimQ(c.req.query("q"))
  const skip = (page - 1) * LIST_PAGE

  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { displayUsername: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {}

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: LIST_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        displayUsername: true,
        image: true,
        createdAt: true,
        isVerified: true,
        isCommunityLeader: true,
        isModerator: true,
        isAdmin: true,
        isBanned: true,
        _count: { select: { builds: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return c.json({
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      displayUsername: u.displayUsername,
      image: u.image,
      createdAt: u.createdAt.toISOString(),
      isVerified: u.isVerified,
      isCommunityLeader: u.isCommunityLeader,
      isModerator: u.isModerator,
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      buildCount: u._count.builds,
    })),
    total,
    page,
    limit: LIST_PAGE,
  })
})

admin.patch("/users/:id", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const targetId = c.req.param("id")

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "invalid_json" }, 400)
  }
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid_body" }, 400)
  }
  const b = body as Record<string, unknown>

  const data: Partial<Record<UserFlag, boolean>> = {}
  for (const key of Object.keys(b)) {
    if (!(USER_FLAGS as readonly string[]).includes(key)) {
      return c.json({ error: "invalid_field" }, 400)
    }
    const v = b[key]
    if (typeof v !== "boolean") {
      return c.json({ error: "invalid_value" }, 400)
    }
    data[key as UserFlag] = v
  }

  if (Object.keys(data).length === 0) {
    return c.json({ error: "empty_patch" }, 400)
  }

  if (targetId === actor.id) {
    if (data.isAdmin === false) {
      return c.json({ error: "cannot_self_demote" }, 400)
    }
    if (data.isBanned === true) {
      return c.json({ error: "cannot_self_ban" }, 400)
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: targetId },
      data,
      select: {
        id: true,
        isVerified: true,
        isCommunityLeader: true,
        isModerator: true,
        isAdmin: true,
        isBanned: true,
      },
    })
    return c.json(updated)
  } catch (err) {
    if (isPrismaNotFound(err)) return c.json({ error: "not_found" }, 404)
    throw err
  }
})

admin.delete("/users/:id", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const targetId = c.req.param("id")
  if (targetId === actor.id) {
    return c.json({ error: "cannot_self_delete" }, 400)
  }

  try {
    await prisma.user.delete({ where: { id: targetId } })
  } catch (err) {
    if (isPrismaNotFound(err)) return c.json({ error: "not_found" }, 404)
    throw err
  }
  return c.body(null, 204)
})

admin.get("/builds", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: {},
    baseFilter: Prisma.sql`TRUE`,
    defaultSort: "newest",
  })
  return c.json(result)
})

admin.delete("/builds/:slug", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const slug = c.req.param("slug")
  try {
    await prisma.build.delete({ where: { slug } })
  } catch (err) {
    if (isPrismaNotFound(err)) return c.json({ error: "not_found" }, 404)
    throw err
  }
  return c.body(null, 204)
})

admin.get("/orgs", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const page = parsePage(c.req.query("page"))
  const q = trimQ(c.req.query("q"))
  const skip = (page - 1) * LIST_PAGE

  const where: Prisma.OrganizationWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      }
    : {}

  const [rows, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: LIST_PAGE,
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        description: true,
        createdAt: true,
        _count: { select: { members: true, builds: true } },
      },
    }),
    prisma.organization.count({ where }),
  ])

  return c.json({
    orgs: rows.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      image: o.image,
      description: o.description,
      createdAt: o.createdAt.toISOString(),
      memberCount: o._count.members,
      buildCount: o._count.builds,
    })),
    total,
    page,
    limit: LIST_PAGE,
  })
})

admin.delete("/orgs/:slug", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const slug = c.req.param("slug").toLowerCase()
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!org) return c.json({ error: "not_found" }, 404)

  await prisma.$transaction([
    prisma.build.updateMany({
      where: { organizationId: org.id },
      data: { organizationId: null },
    }),
    prisma.organization.delete({ where: { id: org.id } }),
  ])
  return c.body(null, 204)
})

admin.get("/stats", async (c) => {
  const actor = await requireAdmin(c)
  if (actor instanceof Response) return actor

  const now = new Date()
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    userCount,
    orgCount,
    buildCount,
    buildsDay,
    buildsWeek,
    buildsMonth,
    byCategory,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.build.count(),
    prisma.build.count({ where: { createdAt: { gte: day } } }),
    prisma.build.count({ where: { createdAt: { gte: week } } }),
    prisma.build.count({ where: { createdAt: { gte: month } } }),
    prisma.build.groupBy({
      by: ["itemCategory"],
      _count: { _all: true },
      orderBy: { _count: { itemCategory: "desc" } },
    }),
  ])

  return c.json({
    userCount,
    orgCount,
    buildCount,
    buildsDay,
    buildsWeek,
    buildsMonth,
    buildsByCategory: byCategory.map((r) => ({
      category: r.itemCategory,
      count: r._count._all,
    })),
  })
})
