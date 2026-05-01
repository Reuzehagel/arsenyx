import { isValidCategory } from "@arsenyx/shared/warframe/categories"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"

export const LIST_LIMIT = 24
export const LIST_SORTS = [
  "newest",
  "updated",
  "top",
  "bookmarked",
  "viewed",
] as const
export type ListSort = (typeof LIST_SORTS)[number]

export const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  visibility: true,
  likeCount: true,
  bookmarkCount: true,
  viewCount: true,
  hasGuide: true,
  hasShards: true,
  createdAt: true,
  updatedAt: true,
  itemName: true,
  itemImageName: true,
  itemCategory: true,
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
} as const

export type ListRow = Prisma.BuildGetPayload<{ select: typeof LIST_SELECT }>

export const DETAIL_INCLUDE = {
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
} as const

export type DetailRow = Prisma.BuildGetPayload<{
  include: typeof DETAIL_INCLUDE
}>

export type ViewerState = {
  isOwner: boolean
  hasLiked: boolean
  hasBookmarked: boolean
}

// Single source of truth for the build-detail JSON shape, used by both the
// session-cookie route (`GET /builds/:slug`) and the public PAT route
// (`GET /api/v1/builds/:slug`). Pass `viewer` for the session route; omit
// for the public API which doesn't have viewer-specific fields.
export function serializeBuildDetail(b: DetailRow, viewer: ViewerState | null) {
  const base = {
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    visibility: b.visibility,
    item: {
      uniqueName: b.itemUniqueName,
      category: b.itemCategory,
      name: b.itemName,
      imageName: b.itemImageName,
    },
    buildData: b.buildData,
    hasShards: b.hasShards,
    hasGuide: b.hasGuide,
    likeCount: b.likeCount,
    bookmarkCount: b.bookmarkCount,
    viewCount: b.viewCount,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    user: b.user,
    organization: b.organization,
    guide: b.buildGuide,
  }
  if (!viewer) return base
  return {
    ...base,
    isOwner: viewer.isOwner,
    viewerHasLiked: viewer.hasLiked,
    viewerHasBookmarked: viewer.hasBookmarked,
  }
}

export function serializeListRow(b: ListRow) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    visibility: b.visibility,
    likeCount: b.likeCount,
    bookmarkCount: b.bookmarkCount,
    viewCount: b.viewCount,
    hasGuide: b.hasGuide,
    hasShards: b.hasShards,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    item: {
      name: b.itemName,
      imageName: b.itemImageName,
      category: b.itemCategory,
    },
    user: b.user,
    organization: b.organization,
  }
}

export type ListFilters = {
  page: number
  sort: ListSort | undefined
  q: string | undefined
  category: string | undefined
  hasGuide: boolean
  hasShards: boolean
}

export function parseListQuery(c: {
  req: { query: (k: string) => string | undefined }
}): ListFilters {
  const pageRaw = parseInt(c.req.query("page") ?? "1", 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
  const sortRaw = c.req.query("sort")
  const sort: ListSort | undefined = (LIST_SORTS as readonly string[]).includes(
    sortRaw ?? "",
  )
    ? (sortRaw as ListSort)
    : undefined
  const qRaw = c.req.query("q")?.trim()
  const q = qRaw && qRaw.length > 0 ? qRaw.slice(0, 200) : undefined
  const catRaw = c.req.query("category")
  const category = catRaw && isValidCategory(catRaw) ? catRaw : undefined
  const hasGuide = c.req.query("hasGuide") === "1"
  const hasShards = c.req.query("hasShards") === "1"
  return { page, sort, q, category, hasGuide, hasShards }
}

function orderByForSort(sort: ListSort) {
  switch (sort) {
    case "updated":
      return [{ updatedAt: "desc" as const }]
    case "top":
      return [{ likeCount: "desc" as const }, { createdAt: "desc" as const }]
    case "bookmarked":
      return [
        { bookmarkCount: "desc" as const },
        { createdAt: "desc" as const },
      ]
    case "viewed":
      return [{ viewCount: "desc" as const }, { createdAt: "desc" as const }]
    case "newest":
    default:
      return [{ createdAt: "desc" as const }]
  }
}

/**
 * Search path: tsvector match ordered by ts_rank (with sort as tiebreaker).
 * Returns the paginated ID list + total match count.
 */
function tiebreakerSql(sort: ListSort) {
  switch (sort) {
    case "updated":
      return Prisma.sql`"updatedAt" DESC`
    case "top":
      return Prisma.sql`"likeCount" DESC, "createdAt" DESC`
    case "bookmarked":
      return Prisma.sql`"bookmarkCount" DESC, "createdAt" DESC`
    case "viewed":
      return Prisma.sql`"viewCount" DESC, "createdAt" DESC`
    case "newest":
    default:
      return Prisma.sql`"createdAt" DESC`
  }
}

async function searchBuildIds(params: {
  q: string
  category: string | undefined
  hasGuide: boolean
  hasShards: boolean
  baseFilter: Prisma.Sql
  sort: ListSort
  skip: number
  take: number
}): Promise<{ ids: string[]; total: number }> {
  const { q, category, hasGuide, hasShards, baseFilter, sort, skip, take } =
    params
  const query = Prisma.sql`websearch_to_tsquery('english', ${q})`
  const categoryFilter = category
    ? Prisma.sql`AND "itemCategory" = ${category}`
    : Prisma.empty
  const guideFilter = hasGuide
    ? Prisma.sql`AND "hasGuide" = true`
    : Prisma.empty
  const shardsFilter = hasShards
    ? Prisma.sql`AND "hasShards" = true`
    : Prisma.empty
  const tiebreaker = tiebreakerSql(sort)

  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM builds
      WHERE "searchVector" @@ ${query}
        AND ${baseFilter}
        ${categoryFilter}
        ${guideFilter}
        ${shardsFilter}
      ORDER BY ts_rank("searchVector", ${query}) DESC, ${tiebreaker}
      LIMIT ${take} OFFSET ${skip}
    `),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n
      FROM builds
      WHERE "searchVector" @@ ${query}
        AND ${baseFilter}
        ${categoryFilter}
        ${guideFilter}
        ${shardsFilter}
    `),
  ])
  return { ids: rows.map((r) => r.id), total: totalRows[0]?.n ?? 0 }
}

export async function runList({
  filters,
  baseWhere,
  baseFilter,
  defaultSort,
}: {
  filters: ListFilters
  baseWhere: Record<string, unknown>
  baseFilter: Prisma.Sql
  defaultSort: ListSort
}) {
  const { page, q, category, hasGuide, hasShards } = filters
  const sort: ListSort = filters.sort ?? defaultSort
  const skip = (page - 1) * LIST_LIMIT

  const where: Record<string, unknown> = { ...baseWhere }
  if (category) where.itemCategory = category
  if (hasGuide) where.hasGuide = true
  if (hasShards) where.hasShards = true

  if (q) {
    const { ids, total } = await searchBuildIds({
      q,
      category,
      hasGuide,
      hasShards,
      baseFilter,
      sort,
      skip,
      take: LIST_LIMIT,
    })
    if (ids.length === 0) {
      return { builds: [], total, page, limit: LIST_LIMIT }
    }
    const rows = await prisma.build.findMany({
      where: { id: { in: ids } },
      select: LIST_SELECT,
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((r): r is ListRow => r != null)
    return {
      builds: ordered.map(serializeListRow),
      total,
      page,
      limit: LIST_LIMIT,
    }
  }

  const [rows, total] = await Promise.all([
    prisma.build.findMany({
      where,
      orderBy: orderByForSort(sort),
      skip,
      take: LIST_LIMIT,
      select: LIST_SELECT,
    }),
    prisma.build.count({ where }),
  ])

  return {
    builds: rows.map(serializeListRow),
    total,
    page,
    limit: LIST_LIMIT,
  }
}
