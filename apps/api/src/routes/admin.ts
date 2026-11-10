import type {
  AdminStats,
  AdminUser,
  AdminUserFlag,
} from "@arsenyx/shared/api/admin"
import { isBuildVisibility } from "@arsenyx/shared/api/build-dto"
import { Hono } from "hono"

import { prisma } from "../db"
import { requireAdmin } from "../lib/session"
import { beforeUserDeletion } from "../lib/user-deletion"
import { parseJsonBody } from "../lib/validate"
import { rateLimitUser } from "../middleware/rate-limit"
import { BUILD_USER_SELECT, parseListQuery, runList } from "./_build-list"
import {
  deleteBuild,
  deleteOrganization,
  invalidateBuilds,
  snapshotSlugs,
} from "./_build-snapshot"
import { allBuildsScope } from "./_build-visibility"
import { orgDirectorySelect, toOrgDirectoryItem } from "./_org-directory"
import { directoryPage, directoryQuery, matchAny } from "./_query"

export const admin = new Hono()

// The privileged flags settable here — Better Auth's `input: false`
// additionalFields (auth.ts), which /auth/update-user refuses.
const USER_FLAGS = [
  "isAdmin",
  "isModerator",
  "isCommunityLeader",
  "isVerified",
  "isBanned",
] as const satisfies readonly AdminUserFlag[]

const isUserFlag = (k: string): k is AdminUserFlag =>
  (USER_FLAGS as readonly string[]).includes(k)

const LIST_PAGE = 24

// Admin destructive ops + list/search are throttled with the same per-user
// buckets the public surface uses. The cap is well above any plausible
// admin workflow; the goal is to bound damage if a privileged session is
// ever exfiltrated (stolen device, browser extension exfil, etc.) before
// the admin notices and revokes. List/search uses `includeSafeMethods`
// because the unindexed ILIKE %q% across four columns is the expensive
// path here, not the writes.
const adminMutateLimit = rateLimitUser("mutate")
const adminSearchLimit = rateLimitUser("search", { includeSafeMethods: true })

admin.get("/users", adminSearchLimit, async (c) => {
  await requireAdmin(c)

  const dir = directoryQuery(c, LIST_PAGE)
  const where = matchAny(dir.q, [
    "username",
    "email",
    "displayUsername",
    "name",
  ])

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: dir.skip,
      take: dir.limit,
      select: {
        ...BUILD_USER_SELECT,
        email: true,
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

  const users = rows.map(({ _count, createdAt, ...u }): AdminUser => ({
    ...u,
    createdAt: createdAt.toISOString(),
    buildCount: _count.builds,
  }))
  return c.json(directoryPage("users", users, total, dir))
})

admin.patch("/users/:id", adminMutateLimit, async (c) => {
  const actor = await requireAdmin(c)
  const targetId = c.req.param("id")
  const b = await parseJsonBody(c, { maxBytes: 2 * 1024 })

  const data: Partial<Record<AdminUserFlag, boolean>> = {}
  for (const [key, v] of Object.entries(b)) {
    if (!isUserFlag(key)) return c.json({ error: "invalid_field" }, 400)
    if (typeof v !== "boolean") return c.json({ error: "invalid_value" }, 400)
    data[key] = v
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
  // Better Auth caches `isBanned` in the session cookie for up to 60s
  // (auth.ts), so a ban only takes effect on cookie refresh. Delete the
  // user's sessions to force re-auth on the next request.
  if (data.isBanned === true) {
    await prisma.session.deleteMany({ where: { userId: targetId } })
  }
  return c.json(updated)
})

admin.delete("/users/:id", adminMutateLimit, async (c) => {
  const actor = await requireAdmin(c)

  const targetId = c.req.param("id")
  if (targetId === actor.id) {
    return c.json({ error: "cannot_self_delete" }, 400)
  }

  // Read before the delete: the user's builds cascade away with it.
  const slugs = await snapshotSlugs({ userId: targetId })
  await prisma.$transaction([
    ...beforeUserDeletion(targetId),
    prisma.user.delete({ where: { id: targetId } }),
  ])
  invalidateBuilds(c, slugs)
  return c.body(null, 204)
})

admin.get("/builds", adminSearchLimit, async (c) => {
  await requireAdmin(c)

  const result = await runList({
    filters: parseListQuery(c),
    ...allBuildsScope(),
    defaultSort: "newest",
    revealAuthor: true,
  })
  return c.json(result)
})

admin.patch("/builds/:slug", adminMutateLimit, async (c) => {
  await requireAdmin(c)

  const slug = c.req.param("slug")
  const visibility = (await parseJsonBody(c, { maxBytes: 1024 })).visibility
  if (!isBuildVisibility(visibility)) {
    return c.json({ error: "invalid_visibility" }, 400)
  }

  const updated = await prisma.build.update({
    where: { slug },
    data: { visibility },
    select: {
      id: true,
      slug: true,
      visibility: true,
      partnerBuilds: { select: { slug: true } },
    },
  })
  // A build flipped to PRIVATE must stop being served publicly.
  const { partnerBuilds, ...result } = updated
  invalidateBuilds(c, [result.slug, ...partnerBuilds.map((p) => p.slug)])
  return c.json(result)
})

admin.delete("/builds/:slug", adminMutateLimit, async (c) => {
  const actor = await requireAdmin(c)

  if (!(await deleteBuild(c, { slug: c.req.param("slug") }, actor.id))) {
    return c.json({ error: "not_found" }, 404)
  }
  return c.body(null, 204)
})

admin.get("/orgs", adminSearchLimit, async (c) => {
  await requireAdmin(c)

  const dir = directoryQuery(c, LIST_PAGE)
  const where = matchAny(dir.q, ["name", "slug"])

  const [rows, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: dir.skip,
      take: dir.limit,
      select: orgDirectorySelect(true),
    }),
    prisma.organization.count({ where }),
  ])

  return c.json(directoryPage("orgs", rows.map(toOrgDirectoryItem), total, dir))
})

admin.patch("/orgs/:slug", adminMutateLimit, async (c) => {
  await requireAdmin(c)

  const verified = (await parseJsonBody(c, { maxBytes: 1024 })).verified
  if (typeof verified !== "boolean") {
    return c.json({ error: "invalid_verified" }, 400)
  }

  const slug = c.req.param("slug").toLowerCase()
  const updated = await prisma.organization.update({
    where: { slug },
    data: { verified },
    select: { id: true, slug: true, verified: true },
  })
  // The verified badge is embedded in the org's build snapshots.
  invalidateBuilds(c, await snapshotSlugs({ organizationId: updated.id }))
  return c.json(updated)
})

admin.delete("/orgs/:slug", adminMutateLimit, async (c) => {
  await requireAdmin(c)

  const org = await prisma.organization.findUnique({
    where: { slug: c.req.param("slug").toLowerCase() },
    select: { id: true },
  })
  if (!org) return c.json({ error: "not_found" }, 404)

  await deleteOrganization(c, org.id)
  return c.body(null, 204)
})

admin.get("/stats", async (c) => {
  await requireAdmin(c)

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
  } satisfies AdminStats)
})
