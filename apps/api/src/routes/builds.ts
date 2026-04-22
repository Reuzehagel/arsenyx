import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import { Hono, type Context } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { customAlphabet } from "nanoid"

import { auth } from "../auth"
import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { BuildVisibility } from "../generated/prisma/enums"
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace"
import { invalidateBuildScreenshot } from "../lib/screenshot-invalidate"
import { parseListQuery, runList } from "./_build-list"

export const builds = new Hono()

// URL-safe alphabet without visually-confusing chars (no 0/O, 1/l/I).
const generateSlug = customAlphabet(
  "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
  10,
)

const MAX_NAME = 120
const MAX_DESCRIPTION = 2000
const MAX_GUIDE_SUMMARY = 400
const MAX_GUIDE_DESCRIPTION = 50_000

function isVisibility(v: unknown): v is BuildVisibility {
  return (
    typeof v === "string" &&
    Object.values(BuildVisibility).includes(v as BuildVisibility)
  )
}

function trimToMax(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t.slice(0, max) : null
}

function hasShardsInBuildData(buildData: unknown): boolean {
  if (!buildData || typeof buildData !== "object") return false
  const shards = (buildData as Record<string, unknown>).shards
  return Array.isArray(shards) && shards.some((s) => s != null)
}

function parseGuide(input: unknown) {
  if (!input || typeof input !== "object") return null
  const g = input as Record<string, unknown>
  const summary = trimToMax(g.summary, MAX_GUIDE_SUMMARY)
  const description = trimToMax(g.description, MAX_GUIDE_DESCRIPTION)
  return {
    summary,
    description,
    hasGuide: summary != null || description != null,
  }
}

builds.post("/", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

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

  const itemUniqueName =
    typeof b.itemUniqueName === "string" ? b.itemUniqueName.trim() : ""
  const itemCategory = typeof b.itemCategory === "string" ? b.itemCategory : ""
  const itemName = typeof b.itemName === "string" ? b.itemName.trim() : ""
  const itemImageName =
    typeof b.itemImageName === "string" ? b.itemImageName : null
  const name = typeof b.name === "string" ? b.name.trim() : ""
  const description = trimToMax(b.description, MAX_DESCRIPTION)
  const userDefault = (session.user as { defaultBuildVisibility?: string })
    .defaultBuildVisibility
  const visibility: BuildVisibility = isVisibility(b.visibility)
    ? b.visibility
    : isVisibility(userDefault)
      ? userDefault
      : "PUBLIC"

  if (!itemUniqueName) return c.json({ error: "missing_item_unique_name" }, 400)
  if (!isValidCategory(itemCategory))
    return c.json({ error: "invalid_category" }, 400)
  if (!itemName) return c.json({ error: "missing_item_name" }, 400)
  if (!name || name.length > MAX_NAME)
    return c.json({ error: "invalid_name" }, 400)
  if (!b.buildData || typeof b.buildData !== "object") {
    return c.json({ error: "invalid_build_data" }, 400)
  }

  const buildData = b.buildData as InputJsonValue
  const guide = parseGuide(b.guide)

  const orgResult = await resolveOrgAssignment(
    b.organizationId,
    session.user.id,
  )
  if (!orgResult.ok) return c.json({ error: orgResult.error }, orgResult.status)
  const organizationId = orgResult.value

  // Retry on the astronomically-unlikely slug collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug()
    try {
      const created = await prisma.build.create({
        data: {
          slug,
          userId: session.user.id,
          itemUniqueName,
          itemCategory,
          itemName,
          itemImageName,
          name,
          description,
          visibility,
          organizationId,
          buildData,
          hasShards: hasShardsInBuildData(buildData),
          hasGuide: guide?.hasGuide ?? false,
          buildGuide: guide?.hasGuide
            ? {
                create: {
                  summary: guide.summary,
                  description: guide.description,
                },
              }
            : undefined,
        },
        select: { id: true, slug: true },
      })
      return c.json(created, 201)
    } catch (err: unknown) {
      // P2002 = unique constraint on slug → retry
      if (
        typeof err === "object" &&
        err != null &&
        (err as { code?: string }).code === "P2002"
      ) {
        continue
      }
      throw err
    }
  }

  return c.json({ error: "slug_collision" }, 500)
})

builds.patch("/:slug", async (c) => {
  const slug = c.req.param("slug")

  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const existing = await prisma.build.findUnique({
    where: { slug },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!existing) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(existing, session.user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

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
    const name = b.name.trim()
    if (!name || name.length > MAX_NAME)
      return c.json({ error: "invalid_name" }, 400)
    data.name = name
  }
  if (typeof b.description === "string" || b.description === null) {
    data.description = trimToMax(b.description, MAX_DESCRIPTION)
  }
  if (isVisibility(b.visibility)) {
    data.visibility = b.visibility
  }
  if (b.organizationId === null || typeof b.organizationId === "string") {
    const orgResult = await resolveOrgAssignment(
      b.organizationId,
      session.user.id,
    )
    if (!orgResult.ok)
      return c.json({ error: orgResult.error }, orgResult.status)
    data.organizationId = orgResult.value
  }
  if (b.buildData && typeof b.buildData === "object") {
    data.buildData = b.buildData as InputJsonValue
    data.hasShards = hasShardsInBuildData(b.buildData)
  }

  const guide = parseGuide(b.guide)
  if (guide) {
    data.hasGuide = guide.hasGuide
    data.buildGuide = {
      upsert: {
        create: { summary: guide.summary, description: guide.description },
        update: { summary: guide.summary, description: guide.description },
      },
    }
  }

  const updated = await prisma.build.update({
    where: { id: existing.id },
    data,
    select: { id: true, slug: true },
  })
  invalidateBuildScreenshot(updated.slug)
  return c.json(updated)
})

builds.delete("/:slug", async (c) => {
  const slug = c.req.param("slug")

  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const existing = await prisma.build.findUnique({
    where: { slug },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!existing) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(existing, session.user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  await prisma.build.delete({ where: { id: existing.id } })
  invalidateBuildScreenshot(slug)
  return c.body(null, 204)
})

builds.post("/:slug/fork", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const source = await prisma.build.findUnique({
    where: { slug: c.req.param("slug") },
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      itemUniqueName: true,
      itemCategory: true,
      itemName: true,
      itemImageName: true,
      name: true,
      buildData: true,
      hasShards: true,
    },
  })
  if (!source) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(source, userId))) {
    return c.json({ error: "not_found" }, 404)
  }

  const forkName = `Fork of ${source.name}`.slice(0, MAX_NAME)

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug()
    try {
      const created = await prisma.build.create({
        data: {
          slug,
          userId,
          itemUniqueName: source.itemUniqueName,
          itemCategory: source.itemCategory,
          itemName: source.itemName,
          itemImageName: source.itemImageName,
          name: forkName,
          visibility: "PRIVATE",
          buildData: source.buildData as InputJsonValue,
          hasShards: source.hasShards,
          forkedFromId: source.id,
        },
        select: { id: true, slug: true },
      })
      return c.json(created, 201)
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err != null &&
        (err as { code?: string }).code === "P2002"
      ) {
        continue
      }
      throw err
    }
  }

  return c.json({ error: "slug_collision" }, 500)
})

builds.get("/", async (c) => {
  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: { visibility: BuildVisibility.PUBLIC },
    baseFilter: Prisma.sql`visibility = 'PUBLIC'`,
    defaultSort: "newest",
  })
  return c.json(result)
})

builds.get("/mine", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: { userId: session.user.id },
    baseFilter: Prisma.sql`"userId" = ${session.user.id}`,
    defaultSort: "updated",
  })
  return c.json(result)
})

builds.get("/bookmarks", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  // Bookmarked AND visible to viewer (own / public / unlisted; not others' private).
  const result = await runList({
    filters: parseListQuery(c),
    baseWhere: {
      bookmarks: { some: { userId } },
      OR: [
        { visibility: BuildVisibility.PUBLIC },
        { visibility: BuildVisibility.UNLISTED },
        { userId },
      ],
    },
    baseFilter: Prisma.sql`
      EXISTS (
        SELECT 1 FROM build_bookmarks bb
        WHERE bb."buildId" = builds.id AND bb."userId" = ${userId}
      )
      AND (visibility IN ('PUBLIC', 'UNLISTED') OR "userId" = ${userId})
    `,
    defaultSort: "newest",
  })
  return c.json(result)
})

async function getBuildForSocial(slug: string) {
  return prisma.build.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      likeCount: true,
      bookmarkCount: true,
    },
  })
}

async function canViewerSeeBuild(
  build: {
    userId: string
    visibility: BuildVisibility
    organizationId: string | null
  },
  viewerId: string,
) {
  if (build.visibility === "PUBLIC" || build.visibility === "UNLISTED")
    return true
  if (build.userId === viewerId) return true
  if (build.organizationId) {
    return isOrgMember(build.organizationId, viewerId)
  }
  return false
}

builds.post("/:slug/like", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(build, userId))) {
    return c.json({ error: "not_found" }, 404)
  }
  if (build.userId === userId) {
    return c.json({ error: "cannot_like_own_build" }, 400)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildLike.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    })
    if (existing) {
      return { hasLiked: true, likeCount: build.likeCount }
    }
    await tx.buildLike.create({
      data: { userId, buildId: build.id, value: 1 },
    })
    const rows = await tx.$queryRaw<{ likeCount: number }[]>`
      UPDATE builds SET "likeCount" = "likeCount" + 1 WHERE id = ${build.id} RETURNING "likeCount"
    `
    return { hasLiked: true, likeCount: rows[0]?.likeCount ?? build.likeCount + 1 }
  })
  return c.json(updated)
})

builds.delete("/:slug/like", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildLike.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    })
    if (!existing) {
      return { hasLiked: false, likeCount: build.likeCount }
    }
    await tx.buildLike.delete({ where: { id: existing.id } })
    const rows = await tx.$queryRaw<{ likeCount: number }[]>`
      UPDATE builds SET "likeCount" = "likeCount" - 1 WHERE id = ${build.id} RETURNING "likeCount"
    `
    return { hasLiked: false, likeCount: rows[0]?.likeCount ?? Math.max(0, build.likeCount - 1) }
  })
  return c.json(updated)
})

builds.post("/:slug/bookmark", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(build, userId))) {
    return c.json({ error: "not_found" }, 404)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildBookmark.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    })
    if (existing) {
      return { hasBookmarked: true, bookmarkCount: build.bookmarkCount }
    }
    await tx.buildBookmark.create({ data: { userId, buildId: build.id } })
    const rows = await tx.$queryRaw<{ bookmarkCount: number }[]>`
      UPDATE builds SET "bookmarkCount" = "bookmarkCount" + 1 WHERE id = ${build.id} RETURNING "bookmarkCount"
    `
    return { hasBookmarked: true, bookmarkCount: rows[0]?.bookmarkCount ?? build.bookmarkCount + 1 }
  })
  return c.json(updated)
})

builds.delete("/:slug/bookmark", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)
  const userId = session.user.id

  const build = await getBuildForSocial(c.req.param("slug"))
  if (!build) return c.json({ error: "not_found" }, 404)

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.buildBookmark.findUnique({
      where: { userId_buildId: { userId, buildId: build.id } },
      select: { id: true },
    })
    if (!existing) {
      return { hasBookmarked: false, bookmarkCount: build.bookmarkCount }
    }
    await tx.buildBookmark.delete({ where: { id: existing.id } })
    const rows = await tx.$queryRaw<{ bookmarkCount: number }[]>`
      UPDATE builds SET "bookmarkCount" = "bookmarkCount" - 1 WHERE id = ${build.id} RETURNING "bookmarkCount"
    `
    return { hasBookmarked: false, bookmarkCount: rows[0]?.bookmarkCount ?? Math.max(0, build.bookmarkCount - 1) }
  })
  return c.json(updated)
})

builds.get("/:slug", async (c) => {
  const slug = c.req.param("slug")

  const [session, build] = await Promise.all([
    auth.api.getSession({ headers: c.req.raw.headers }),
    prisma.build.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
          },
        },
        organization: {
          select: { id: true, name: true, slug: true, image: true },
        },
        buildGuide: {
          select: { summary: true, description: true, updatedAt: true },
        },
      },
    }),
  ])

  if (!build) return c.json({ error: "not_found" }, 404)

  const viewerId = session?.user.id
  const canView =
    build.visibility === "PUBLIC" ||
    build.visibility === "UNLISTED" ||
    (viewerId != null && build.userId === viewerId) ||
    (viewerId != null &&
      build.organizationId != null &&
      (await isOrgMember(build.organizationId, viewerId)))

  if (!canView) return c.json({ error: "not_found" }, 404)

  await maybeIncrementView(c, build.id, build.slug, viewerId, build.userId)

  let viewerHasLiked = false
  let viewerHasBookmarked = false
  if (viewerId) {
    const [like, bookmark] = await Promise.all([
      prisma.buildLike.findUnique({
        where: { userId_buildId: { userId: viewerId, buildId: build.id } },
        select: { id: true },
      }),
      prisma.buildBookmark.findUnique({
        where: { userId_buildId: { userId: viewerId, buildId: build.id } },
        select: { id: true },
      }),
    ])
    viewerHasLiked = like != null
    viewerHasBookmarked = bookmark != null
  }

  return c.json({
    id: build.id,
    slug: build.slug,
    name: build.name,
    description: build.description,
    visibility: build.visibility,
    item: {
      uniqueName: build.itemUniqueName,
      category: build.itemCategory,
      name: build.itemName,
      imageName: build.itemImageName,
    },
    buildData: build.buildData,
    hasShards: build.hasShards,
    hasGuide: build.hasGuide,
    likeCount: build.likeCount,
    bookmarkCount: build.bookmarkCount,
    viewCount: build.viewCount,
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
    user: build.user,
    organization: build.organization,
    guide: build.buildGuide,
    isOwner:
      viewerId != null &&
      (await canMutateBuild(
        { userId: build.userId, organizationId: build.organizationId },
        viewerId,
      )),
    viewerHasLiked,
    viewerHasBookmarked,
  })
})

const VIEW_COOKIE_MAX_AGE = 12 * 60 * 60 // 12h

async function maybeIncrementView(
  c: Context,
  buildId: string,
  slug: string,
  viewerId: string | undefined,
  ownerId: string,
) {
  if (viewerId && viewerId === ownerId) return
  const cookieName = `vw_${slug}`
  if (getCookie(c, cookieName)) return
  await prisma.$executeRaw`
    UPDATE builds SET "viewCount" = "viewCount" + 1 WHERE id = ${buildId}
  `
  const isProd = process.env.NODE_ENV === "production"
  setCookie(c, cookieName, "1", {
    path: "/",
    maxAge: VIEW_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: isProd ? "None" : "Lax",
    secure: isProd,
  })
}

async function canMutateBuild(
  existing: { userId: string; organizationId: string | null },
  sessionUserId: string,
) {
  if (existing.userId === sessionUserId) return true
  if (existing.organizationId)
    return isOrgMember(existing.organizationId, sessionUserId)
  return false
}

async function isOrgMember(organizationId: string, userId: string) {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  })
  return membership != null
}

type OrgAssignment =
  | { ok: true; value: string | null }
  | { ok: false; error: string; status: 400 | 403 }

async function resolveOrgAssignment(
  raw: unknown,
  userId: string,
): Promise<OrgAssignment> {
  if (raw == null) return { ok: true, value: null }
  if (typeof raw !== "string")
    return { ok: false, error: "invalid_organization_id", status: 400 }
  if (!(await isOrgMember(raw, userId)))
    return { ok: false, error: "not_org_member", status: 403 }
  return { ok: true, value: raw }
}
