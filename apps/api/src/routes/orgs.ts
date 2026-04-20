import { Hono } from "hono"

import { auth } from "../auth"
import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { BuildVisibility, OrgRole } from "../generated/prisma/enums"
import { parseListQuery, runList } from "./_build-list"

export const orgs = new Hono()

const SLUG_RE = /^[a-z0-9-]+$/
const MAX_NAME = 50
const MAX_SLUG = 30
const MAX_DESCRIPTION = 200
const MEMBERS_LIMIT = 200

function trimToMax(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t.slice(0, max) : null
}

function isOrgRole(v: unknown): v is OrgRole {
  return v === "ADMIN" || v === "MEMBER"
}

function hasPrismaCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    (err as { code?: string }).code === code
  )
}

async function requireSessionUser(c: {
  req: { raw: Request }
}): Promise<{ id: string } | Response> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user)
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  return { id: session.user.id }
}

// Loads the org by slug and the viewer's membership in a single round-trip.
// Returns the org.id and the viewer's role (null if not a member).
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
  const user = await requireSessionUser(c)
  if (user instanceof Response) return user

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
        },
      },
    },
  })

  return c.json({
    memberships: memberships.map((m) => ({
      role: m.role,
      organization: m.organization,
    })),
  })
})

orgs.post("/", async (c) => {
  const user = await requireSessionUser(c)
  if (user instanceof Response) return user

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

  const name = trimToMax(b.name, MAX_NAME)
  const slugRaw = trimToMax(b.slug, MAX_SLUG)?.toLowerCase() ?? null
  const description = trimToMax(b.description, MAX_DESCRIPTION)
  const image = trimToMax(b.image, 500)

  if (!name) return c.json({ error: "invalid_name" }, 400)
  if (!slugRaw || !SLUG_RE.test(slugRaw)) {
    return c.json({ error: "invalid_slug" }, 400)
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
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
    if (hasPrismaCode(err, "P2002")) {
      return c.json({ error: "slug_taken" }, 409)
    }
    throw err
  }
})

orgs.get("/:slug", async (c) => {
  const slug = c.req.param("slug").toLowerCase()

  const [session, org] = await Promise.all([
    auth.api.getSession({ headers: c.req.raw.headers }),
    prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        description: true,
        createdAt: true,
        members: {
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          take: MEMBERS_LIMIT,
          select: {
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            builds: { where: { visibility: BuildVisibility.PUBLIC } },
          },
        },
      },
    }),
  ])

  if (!org) return c.json({ error: "not_found" }, 404)

  const viewerId = session?.user.id ?? null
  const viewerMembership = viewerId
    ? (org.members.find((m) => m.user.id === viewerId) ?? null)
    : null

  return c.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    image: org.image,
    description: org.description,
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
  })
})

orgs.get("/:slug/builds", async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!org) return c.json({ error: "not_found" }, 404)

  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: {
      organizationId: org.id,
      visibility: BuildVisibility.PUBLIC,
    },
    baseFilter: Prisma.sql`"organizationId" = ${org.id} AND visibility = 'PUBLIC'`,
    defaultSort: "newest",
  })
  return c.json(result)
})

orgs.patch("/:slug", async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const user = await requireSessionUser(c)
  if (user instanceof Response) return user

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

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

  const data: Record<string, unknown> = {}
  if (typeof b.name === "string") {
    const n = trimToMax(b.name, MAX_NAME)
    if (!n) return c.json({ error: "invalid_name" }, 400)
    data.name = n
  }
  if (typeof b.slug === "string") {
    const s = trimToMax(b.slug, MAX_SLUG)?.toLowerCase() ?? ""
    if (!s || !SLUG_RE.test(s)) return c.json({ error: "invalid_slug" }, 400)
    data.slug = s
  }
  if (typeof b.description === "string" || b.description === null) {
    data.description = trimToMax(b.description, MAX_DESCRIPTION)
  }
  if (typeof b.image === "string" || b.image === null) {
    data.image = trimToMax(b.image, 500)
  }

  try {
    const updated = await prisma.organization.update({
      where: { id: ctx.id },
      data,
      select: { id: true, slug: true },
    })
    return c.json(updated)
  } catch (err) {
    if (hasPrismaCode(err, "P2002")) {
      return c.json({ error: "slug_taken" }, 409)
    }
    throw err
  }
})

orgs.delete("/:slug", async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const user = await requireSessionUser(c)
  if (user instanceof Response) return user

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

  await prisma.organization.delete({ where: { id: ctx.id } })
  return c.body(null, 204)
})

orgs.post("/:slug/members", async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const user = await requireSessionUser(c)
  if (user instanceof Response) return user

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "invalid_json" }, 400)
  }
  const username =
    body && typeof body === "object"
      ? trimToMax((body as Record<string, unknown>).username, 64)?.toLowerCase()
      : null
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

orgs.patch("/:slug/members/:userId", async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const targetUserId = c.req.param("userId")
  const user = await requireSessionUser(c)
  if (user instanceof Response) return user

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)
  if (ctx.role !== "ADMIN") return c.json({ error: "forbidden" }, 403)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "invalid_json" }, 400)
  }
  const role =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).role
      : null
  if (!isOrgRole(role)) return c.json({ error: "invalid_role" }, 400)

  if (role === "MEMBER") {
    const [target, adminCount] = await Promise.all([
      prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.id,
            userId: targetUserId,
          },
        },
        select: { role: true },
      }),
      prisma.organizationMember.count({
        where: { organizationId: ctx.id, role: "ADMIN" },
      }),
    ])
    if (!target) return c.json({ error: "not_member" }, 404)
    if (target.role === "ADMIN" && adminCount <= 1) {
      return c.json({ error: "last_admin" }, 400)
    }
  }

  try {
    const updated = await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: ctx.id,
          userId: targetUserId,
        },
      },
      data: { role },
      select: { role: true },
    })
    return c.json({ userId: targetUserId, role: updated.role })
  } catch (err) {
    if (hasPrismaCode(err, "P2025")) {
      return c.json({ error: "not_member" }, 404)
    }
    throw err
  }
})

orgs.delete("/:slug/members/:userId", async (c) => {
  const slug = c.req.param("slug").toLowerCase()
  const targetUserId = c.req.param("userId")
  const user = await requireSessionUser(c)
  if (user instanceof Response) return user

  const ctx = await loadOrgWithViewerRole(slug, user.id)
  if (!ctx) return c.json({ error: "not_found" }, 404)

  const isSelf = targetUserId === user.id
  if (!isSelf && ctx.role !== "ADMIN") {
    return c.json({ error: "forbidden" }, 403)
  }

  const [target, adminCount] = await Promise.all([
    prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: ctx.id,
          userId: targetUserId,
        },
      },
      select: { role: true },
    }),
    prisma.organizationMember.count({
      where: { organizationId: ctx.id, role: "ADMIN" },
    }),
  ])
  if (!target) return c.json({ error: "not_member" }, 404)
  if (target.role === "ADMIN" && adminCount <= 1) {
    return c.json({ error: "last_admin" }, 400)
  }

  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: {
        organizationId: ctx.id,
        userId: targetUserId,
      },
    },
  })
  return c.body(null, 204)
})
