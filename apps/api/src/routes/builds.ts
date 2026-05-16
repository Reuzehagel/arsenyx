import { isValidCategory } from "@arsenyx/shared/warframe/categories"
import { Hono, type Context } from "hono"
import { getCookie, setCookie } from "hono/cookie"
import { customAlphabet } from "nanoid"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { BuildVisibility } from "../generated/prisma/enums"
import type { InputJsonValue } from "../generated/prisma/internal/prismaNamespace"
import { getSession } from "../lib/session"
import { hasPrismaCode, parseJsonBody, trimToMax } from "../lib/validate"
import { rateLimitUser } from "../middleware/rate-limit"
import {
  DETAIL_INCLUDE,
  LIST_SELECT,
  parseListQuery,
  runList,
  serializeBuildDetail,
  serializeListRow,
} from "./_build-list"

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

builds.post("/", rateLimitUser("mutate"), async (c) => {
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const parsed = await parseJsonBody(c)
  if (!parsed.ok) return parsed.response
  const b = parsed.value

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
      if (hasPrismaCode(err, "P2002")) continue
      throw err
    }
  }

  return c.json({ error: "slug_collision" }, 500)
})

builds.patch("/:slug", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug")

  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

  const existing = await prisma.build.findUnique({
    where: { slug },
    select: { id: true, userId: true, organizationId: true },
  })
  if (!existing) return c.json({ error: "not_found" }, 404)
  if (!(await canMutateBuild(existing, session.user.id))) {
    return c.json({ error: "forbidden" }, 403)
  }

  const parsed = await parseJsonBody(c)
  if (!parsed.ok) return parsed.response
  const b = parsed.value

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
  // The editor flips itemImageName when the incarnon toggle is applied;
  // accept it on PATCH so the build-overview thumbnail tracks the change.
  // Reject undefined deliberately — PATCH treats absent fields as "don't
  // touch" and only string|null as "write this value". POST differs because
  // every create needs a value, so it coerces non-string to null instead.
  if (typeof b.itemImageName === "string" || b.itemImageName === null) {
    data.itemImageName = b.itemImageName
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
  return c.json(updated)
})

builds.delete("/:slug", rateLimitUser("mutate"), async (c) => {
  const slug = c.req.param("slug")

  const session = await getSession(c)
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
  return c.body(null, 204)
})

builds.post("/:slug/fork", rateLimitUser("mutate"), async (c) => {
  const session = await getSession(c)
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

// Lightweight typeahead for the partner-builds picker. Returns up to
// `limit` builds visible to the requester, matched against name or item
// name. Distinct from `runList` because we don't need pagination, sort
// options, or facets — just enough to populate a combobox.
const SEARCH_DEFAULT_LIMIT = 10
const SEARCH_MAX_LIMIT = 20

builds.get("/search", async (c) => {
  const session = await getSession(c)
  const viewerId = session?.user.id
  const q = (c.req.query("q") ?? "").trim().slice(0, 200)
  if (q.length < 2) return c.json({ builds: [] })
  const limitRaw = parseInt(c.req.query("limit") ?? "", 10)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, SEARCH_MAX_LIMIT)
      : SEARCH_DEFAULT_LIMIT

  // PUBLIC only — UNLISTED is "accessible by URL, not enumerable", and a
  // typeahead is enumeration. Viewers can additionally find their own
  // builds regardless of visibility so they can link private/unlisted
  // ones from the editor.
  const rows = await prisma.build.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { itemName: { contains: q, mode: "insensitive" } },
          ],
        },
        viewerId
          ? {
              OR: [
                { visibility: BuildVisibility.PUBLIC },
                { userId: viewerId },
              ],
            }
          : { visibility: BuildVisibility.PUBLIC },
      ],
    },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: LIST_SELECT,
  })
  return c.json({ builds: rows.map(serializeListRow) })
})

async function loadPartnerContext(slug: string, partnerSlug: string) {
  const [own, partner] = await Promise.all([
    prisma.build.findUnique({
      where: { slug },
      select: { id: true, userId: true, organizationId: true },
    }),
    prisma.build.findUnique({
      where: { slug: partnerSlug },
      select: {
        id: true,
        userId: true,
        visibility: true,
        organizationId: true,
      },
    }),
  ])
  return { own, partner }
}

builds.get("/:slug/partners", async (c) => {
  const slug = c.req.param("slug")
  const session = await getSession(c)
  const viewerId = session?.user.id

  // Filter private partners in the DB rather than fetching all rows and
  // filtering in JS — keeps us from over-selecting joined user/org/counts
  // for partners the viewer can't see.
  const partnerVisibility: Prisma.BuildWhereInput = viewerId
    ? {
        OR: [
          { visibility: { in: [BuildVisibility.PUBLIC, BuildVisibility.UNLISTED] } },
          { userId: viewerId },
        ],
      }
    : { visibility: { in: [BuildVisibility.PUBLIC, BuildVisibility.UNLISTED] } }

  const build = await prisma.build.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
      visibility: true,
      organizationId: true,
      partnerBuilds: {
        where: partnerVisibility,
        take: 50,
        select: LIST_SELECT,
      },
    },
  })
  if (!build) return c.json({ error: "not_found" }, 404)
  if (!(await canViewerSeeBuild(build, viewerId ?? ""))) {
    return c.json({ error: "not_found" }, 404)
  }

  return c.json({ builds: build.partnerBuilds.map(serializeListRow) })
})

builds.put(
  "/:slug/partners/:partnerSlug",
  rateLimitUser("mutate"),
  async (c) => {
    const session = await getSession(c)
    if (!session?.user) return c.json({ error: "unauthorized" }, 401)
    const viewerId = session.user.id

    const slug = c.req.param("slug")
    const partnerSlug = c.req.param("partnerSlug")
    if (slug === partnerSlug) {
      return c.json({ error: "cannot_link_to_self" }, 400)
    }

    const { own, partner } = await loadPartnerContext(slug, partnerSlug)
    if (!own || !partner) return c.json({ error: "not_found" }, 404)
    if (!(await canMutateBuild(own, viewerId))) {
      return c.json({ error: "forbidden" }, 403)
    }
    if (!(await canViewerSeeBuild(partner, viewerId))) {
      return c.json({ error: "not_found" }, 404)
    }

    // Prisma's implicit self-many-to-many writes only one side of the join
    // row, so we mirror the connect in the same transaction. Connect is
    // idempotent — repeating it is a no-op (prisma#14370).
    await prisma.$transaction([
      prisma.build.update({
        where: { id: own.id },
        data: { partnerBuilds: { connect: { id: partner.id } } },
      }),
      prisma.build.update({
        where: { id: partner.id },
        data: { partnerBuilds: { connect: { id: own.id } } },
      }),
    ])
    return c.body(null, 204)
  },
)

builds.delete(
  "/:slug/partners/:partnerSlug",
  rateLimitUser("mutate"),
  async (c) => {
    const session = await getSession(c)
    if (!session?.user) return c.json({ error: "unauthorized" }, 401)
    const viewerId = session.user.id

    const slug = c.req.param("slug")
    const partnerSlug = c.req.param("partnerSlug")
    const { own, partner } = await loadPartnerContext(slug, partnerSlug)
    if (!own || !partner) return c.json({ error: "not_found" }, 404)
    // Either owner can sever the link.
    const [isOwnOwner, isPartnerOwner] = await Promise.all([
      canMutateBuild(own, viewerId),
      canMutateBuild(partner, viewerId),
    ])
    if (!isOwnOwner && !isPartnerOwner) {
      return c.json({ error: "forbidden" }, 403)
    }

    await prisma.$transaction([
      prisma.build.update({
        where: { id: own.id },
        data: { partnerBuilds: { disconnect: { id: partner.id } } },
      }),
      prisma.build.update({
        where: { id: partner.id },
        data: { partnerBuilds: { disconnect: { id: own.id } } },
      }),
    ])
    return c.body(null, 204)
  },
)

builds.get("/mine", async (c) => {
  const session = await getSession(c)
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
  const session = await getSession(c)
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

builds.post("/:slug/like", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
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
    return {
      hasLiked: true,
      likeCount: rows[0]?.likeCount ?? build.likeCount + 1,
    }
  })
  return c.json(updated)
})

builds.delete("/:slug/like", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
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
    return {
      hasLiked: false,
      likeCount: rows[0]?.likeCount ?? Math.max(0, build.likeCount - 1),
    }
  })
  return c.json(updated)
})

builds.post("/:slug/bookmark", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
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
    return {
      hasBookmarked: true,
      bookmarkCount: rows[0]?.bookmarkCount ?? build.bookmarkCount + 1,
    }
  })
  return c.json(updated)
})

builds.delete("/:slug/bookmark", rateLimitUser("social"), async (c) => {
  const session = await getSession(c)
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
    return {
      hasBookmarked: false,
      bookmarkCount:
        rows[0]?.bookmarkCount ?? Math.max(0, build.bookmarkCount - 1),
    }
  })
  return c.json(updated)
})

builds.get("/:slug", async (c) => {
  const slug = c.req.param("slug")

  const [session, build] = await Promise.all([
    getSession(c),
    prisma.build.findUnique({
      where: { slug },
      include: DETAIL_INCLUDE,
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

  const isOwner =
    viewerId != null &&
    (await canMutateBuild(
      { userId: build.userId, organizationId: build.organizationId },
      viewerId,
    ))

  return c.json(
    serializeBuildDetail(build, {
      isOwner,
      hasLiked: viewerHasLiked,
      hasBookmarked: viewerHasBookmarked,
    }),
  )
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
