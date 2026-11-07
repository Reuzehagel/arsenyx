import { LIST_DEFAULT_SORTS } from "@arsenyx/shared/api/build-list"
import {
  MAX_ORGS_PER_USER,
  ORG_DESCRIPTION_MAX,
  ORG_NAME_MAX,
  ORG_SLUG_MAX,
} from "@arsenyx/shared/api/limits"
import type { OrgProfile } from "@arsenyx/shared/api/orgs"
import { Hono } from "hono"

import { prisma } from "../db"
import type { Prisma } from "../generated/prisma/client"
import type { OrgRole } from "../generated/prisma/enums"
import { getSession, requireUser } from "../lib/session"
import {
  hasPrismaCode,
  parseJsonBody,
  trimToMax,
  validateExternalUrl,
} from "../lib/validate"
import { enforceAnonSearchLimit, rateLimitUser } from "../middleware/rate-limit"
import { BUILD_USER_SELECT, parseListQuery, runList } from "./_build-list"
import {
  deleteOrganization,
  invalidateBuilds,
  snapshotSlugs,
} from "./_build-snapshot"
import { ORG_PUBLIC_BUILD, orgListScope } from "./_build-visibility"
import { orgDirectorySelect, toOrgDirectoryItem } from "./_org-directory"
import { directoryPage, directoryQuery, matchAny } from "./_query"

export const orgs = new Hono()

const SLUG_RE = /^[a-z0-9-]+$/
const MEMBERS_LIMIT = 200
const DIRECTORY_PAGE = 20
// Reserved because they collide with sibling paths on the /orgs router
// (`/orgs/public` is registered before `/:slug`; pinned by
// route-order.test.ts).
const RESERVED_SLUGS = new Set(["public"])

class OrgLimitError extends Error {}

function isOrgRole(v: unknown): v is OrgRole {
  return v === "ADMIN" || v === "MEMBER"
}

class LastAdminError extends Error {}

// Run `fn` with the org row locked, so concurrent role changes on one org
// queue up and the "last admin" check below always sees committed state.
function withOrgLock<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM organizations WHERE id = ${organizationId} FOR UPDATE`
    return fn(tx)
  })
}

// Throws LastAdminError if `userId` is the org's only ADMIN; P2025 if not a member.
async function assertNotLastAdmin(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
) {
  const target = await tx.organizationMember.findUniqueOrThrow({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  })
  if (target.role !== "ADMIN") return
  const admins = await tx.organizationMember.count({
    where: { organizationId, role: "ADMIN" },
  })
  if (admins <= 1) throw new LastAdminError()
}

// Loads the org by slug and the viewer's membership in a single round-trip.
// Returns the org.id and the viewer's role (null if not a member). Org roles
// are an org-admin concern, distinct from build access (_build-visibility.ts).
async function loadOrgWithViewerRole(slug: string, viewerId: string) {
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      members: {
        where: { userId: viewerId },
        select: { role: true },
      },
    },
  })
  if (!org) return null
  return { id: org.id, role: org.members[0]?.role ?? null }
}

orgs.get("/", async (c) => {
  const user = await requireUser(c)

  const memberships = await prisma.organizationMember.findMany({
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
          description: true,
          verified: true,
        },
      },
    },
  })

  return c.json({ memberships })
})

orgs.post("/", rateLimitUser("mutate"), async (c) => {
  const user = await requireUser(c)

  const b = await parseJsonBody(c, { maxBytes: 8 * 1024 })

  const name = trimToMax(b.name, ORG_NAME_MAX)
  const slugRaw = trimToMax(b.slug, ORG_SLUG_MAX)?.toLowerCase() ?? null
  const description = trimToMax(b.description, ORG_DESCRIPTION_MAX)
  // Reject anything that's not a parseable absolute https:// URL with a
  // public hostname. A null/empty input is fine (no image); anything else
  // goes through validateExternalUrl, which enforces the 500-char cap —
  // truncating first would silently chop a long signed query token and
  // store a still-parseable but broken URL.
  const image =
    typeof b.image === "string" && b.image.trim().length > 0
      ? validateExternalUrl(b.image)
      : null
  if (typeof b.image === "string" && b.image.trim().length > 0 && !image) {
    return c.json({ error: "invalid_image_url" }, 400)
  }

  if (!name) return c.json({ error: "invalid_name" }, 400)
  if (!slugRaw || !SLUG_RE.test(slugRaw)) {
    return c.json({ error: "invalid_slug" }, 400)
  }
  if (RESERVED_SLUGS.has(slugRaw)) {
    return c.json({ error: "slug_taken" }, 409)
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Cap orgs per user: creating makes you ADMIN, so "already ADMIN
      // somewhere" is the cheapest proxy for "already owns an org" without
      // a creator column. The user-row lock serializes concurrent POSTs.
      await tx.$executeRaw`SELECT 1 FROM users WHERE id = ${user.id} FOR UPDATE`
      const owned = await tx.organizationMember.count({
        where: { userId: user.id, role: "ADMIN" },
      })
      if (owned >= MAX_ORGS_PER_USER) throw new OrgLimitError()
      const org = await tx.organization.create({
        data: { name, slug: slugRaw, description, image },
        select: { id: true, slug: true },
      })
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "ADMIN",
        },
      })
      return org
    })
    return c.json(created, 201)
  } catch (err) {
    if (err instanceof OrgLimitError) {
      return c.json({ error: "org_limit" }, 409)
    }
    if (hasPrismaCode(err, "P2002")) {
      return c.json({ error: "slug_taken" }, 409)
    }
    throw err
  }
})

// Public directory — declared before /:slug so Hono doesn't capture "public" as a slug.
orgs.get("/public", async (c) => {
  const dir = directoryQuery(c, DIRECTORY_PAGE)

  // Only charge the tighter search bucket when a query is actually present —
  // plain directory paging stays on the ANON_READ_LIMITER the router applies.
  if (dir.q) {
    const blocked = await enforceAnonSearchLimit(c, "/orgs/public?q=")
    if (blocked) return blocked
  }

  const where = matchAny(dir.q, ["name", "slug"])
  const [rows, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      // Verified (trusted) orgs lead the directory; within each group, newest
      // first.
      orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
      skip: dir.skip,
      take: dir.limit,
      select: orgDirectorySelect({ where: ORG_PUBLIC_BUILD }),
    }),
    prisma.organization.count({ where }),
  ])

  return c.json(directoryPage("orgs", rows.map(toOrgDirectoryItem), total, dir))
})

orgs.get("/:slug", async (c) => {
  const slug = c.req.param("slug").toLowerCase()

  const [session, org] = await Promise.all([
    getSession(c),
    prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        description: true,
        verified: true,
        createdAt: true,
        members: {
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          take: MEMBERS_LIMIT,
          select: {
            role: true,
            joinedAt: true,
            user: { select: BUILD_USER_SELECT },
          },
        },
        _count: {
          select: {
            builds: { where: ORG_PUBLIC_BUILD },
          },
        },
      },
    }),
  ])

  if (!org) return c.json({ error: "not_found" }, 404)

  const viewerId = session?.user.id
  const viewerMembership = viewerId
    ? org.members.find((m) => m.user.id === viewerId)
    : undefined

  return c.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    image: org.image,
    description: org.description,
    verified: org.verified,
    createdAt: org.createdAt.toISOString(),
    members: org.members.map((m) => ({
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    })),
    buildCount: org._count.builds,
    viewer: {
      role: viewerMembership?.role ?? null,
      isAdmin: viewerMembership?.role === "ADMIN",
    },
  } satisfies OrgProfile)
})

orgs.get("/:slug/builds", async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const [session, org] = await Promise.all([
    getSession(c),
    prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    }),
  ])
  if (!org) return c.json({ error: "not_found" }, 404)

  const result = await runList({
    filters: parseListQuery(c),
    ...(await orgListScope(org.id, session?.user.id)),
    defaultSort: LIST_DEFAULT_SORTS.org,
  })
  return c.json(result)
})

orgs.patch("/:slug", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const user = await requireUser(c)

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

  const b = await parseJsonBody(c, { maxBytes: 8 * 1024 })

  const data: Prisma.OrganizationUpdateInput = {}
  if (typeof b.name === "string") {
    const n = trimToMax(b.name, ORG_NAME_MAX)
    if (!n) return c.json({ error: "invalid_name" }, 400)
    data.name = n
  }
  if (typeof b.slug === "string") {
    const s = trimToMax(b.slug, ORG_SLUG_MAX)?.toLowerCase() ?? ""
    if (!s || !SLUG_RE.test(s)) return c.json({ error: "invalid_slug" }, 400)
    if (RESERVED_SLUGS.has(s)) return c.json({ error: "slug_taken" }, 409)
    data.slug = s
  }
  if (typeof b.description === "string" || b.description === null) {
    data.description = trimToMax(b.description, ORG_DESCRIPTION_MAX)
  }
  if (typeof b.image === "string" || b.image === null) {
    // Validate before any truncation — see POST handler above for rationale.
    if (
      b.image === null ||
      (typeof b.image === "string" && b.image.trim() === "")
    ) {
      data.image = null
    } else {
      const validated = validateExternalUrl(b.image)
      if (!validated) return c.json({ error: "invalid_image_url" }, 400)
      data.image = validated
    }
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: ctx.id },
      data,
      select: { id: true, slug: true },
    })
    // Name, slug and logo are embedded in the org's build snapshots.
    invalidateBuilds(c, await snapshotSlugs({ organizationId: ctx.id }))
    return c.json(updated)
  } catch (err) {
    if (hasPrismaCode(err, "P2002")) {
      return c.json({ error: "slug_taken" }, 409)
    }
    throw err
  }
})

orgs.delete("/:slug", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const user = await requireUser(c)

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

  await deleteOrganization(c, ctx.id)
  return c.body(null, 204)
})

orgs.post("/:slug/members", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const user = await requireUser(c)

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

  const username = trimToMax(
    (await parseJsonBody(c, { maxBytes: 1024 })).username,
    64,
  )?.toLowerCase()
  if (!username) return c.json({ error: "invalid_username" }, 400)

  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })
  if (!target) return c.json({ error: "user_not_found" }, 404)

  try {
    await prisma.organizationMember.create({
      data: {
        organizationId: ctx.id,
        userId: target.id,
        role: "MEMBER",
      },
    })
  } catch (err) {
    if (hasPrismaCode(err, "P2002")) {
      return c.json({ error: "already_member" }, 409)
    }
    throw err
  }

  return c.json({ userId: target.id, role: "MEMBER" }, 201)
})

orgs.patch("/:slug/members/:userId", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const targetUserId = c.req.param("userId")
  const user = await requireUser(c)

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

  const role = (await parseJsonBody(c, { maxBytes: 1024 })).role
  if (!isOrgRole(role)) return c.json({ error: "invalid_role" }, 400)

  try {
    const updated = await withOrgLock(ctx.id, async (tx) => {
      if (role === "MEMBER") await assertNotLastAdmin(tx, ctx.id, targetUserId)
      return tx.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: ctx.id,
            userId: targetUserId,
          },
        },
        data: { role },
        select: { role: true },
      })
    })
    return c.json({ userId: targetUserId, role: updated.role })
  } catch (err) {
    if (err instanceof LastAdminError) {
      return c.json({ error: "last_admin" }, 400)
    }
    if (hasPrismaCode(err, "P2025")) {
      return c.json({ error: "not_member" }, 404)
    }
    throw err
  }
})

orgs.delete("/:slug/members/:userId", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const targetUserId = c.req.param("userId")
  const user = await requireUser(c)

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)

  const isSelf = targetUserId === user.id
  if (!isSelf && ctx.role !== "ADMIN") {
    return c.json({ error: "forbidden" }, 403)
  }

  try {
    await withOrgLock(ctx.id, async (tx) => {
      await assertNotLastAdmin(tx, ctx.id, targetUserId)
      await tx.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: ctx.id,
            userId: targetUserId,
          },
        },
      })
    })
  } catch (err) {
    if (err instanceof LastAdminError) {
      return c.json({ error: "last_admin" }, 400)
    }
    if (hasPrismaCode(err, "P2025")) {
      return c.json({ error: "not_member" }, 404)
    }
    throw err
  }
  return c.body(null, 204)
})
