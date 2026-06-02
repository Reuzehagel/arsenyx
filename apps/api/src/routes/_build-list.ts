import type { BuildListItemResponse } from "@arsenyx/shared/api/build-dto"
import {
  LIST_LIMIT,
  LIST_SORTS,
  type ListSort,
} from "@arsenyx/shared/warframe/build-list"
import { isValidCategory } from "@arsenyx/shared/warframe/categories"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"
import { parsePage, trimQ } from "./_query"

export const LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  visibility: true,
  likeCount: true,
  bookmarkCount: true,
  viewCount: true,
  formaCount: true,
  hasGuide: true,
  hasShards: true,
  hideAuthor: true,
  createdAt: true,
  updatedAt: true,
  itemUniqueName: true,
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
    hideAuthor: b.hideAuthor,
    likeCount: b.likeCount,
    bookmarkCount: b.bookmarkCount,
    viewCount: b.viewCount,
    formaCount: b.formaCount,
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

export function serializeListRow(b: ListRow): BuildListItemResponse {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    visibility: b.visibility,
    likeCount: b.likeCount,
    bookmarkCount: b.bookmarkCount,
    viewCount: b.viewCount,
    formaCount: b.formaCount,
    hasGuide: b.hasGuide,
    hasShards: b.hasShards,
    hideAuthor: b.hideAuthor,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    item: {
      uniqueName: b.itemUniqueName,
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
  limit: number
  sort: ListSort | undefined
  q: string | undefined
  category: string | undefined
  item: string | undefined
  hasGuide: boolean
  hasShards: boolean
}

export function parseListQuery(c: {
  req: { query: (k: string) => string | undefined }
}): ListFilters {
  const page = parsePage(c.req.query("page"))
  const sortRaw = c.req.query("sort")
  const sort: ListSort | undefined = (LIST_SORTS as readonly string[]).includes(
    sortRaw ?? "",
  )
    ? (sortRaw as ListSort)
    : undefined
  const q = trimQ(c.req.query("q"), 200)
  const catRaw = c.req.query("category")
  const category = catRaw && isValidCategory(catRaw) ? catRaw : undefined
  const item = trimQ(c.req.query("item"), 200)
  const limitRaw = parseInt(c.req.query("limit") ?? "", 10)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, LIST_LIMIT)
      : LIST_LIMIT
  const hasGuide = c.req.query("hasGuide") === "1"
  const hasShards = c.req.query("hasShards") === "1"
  return { page, limit, sort, q, category, item, hasGuide, hasShards }
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
    case "forma-asc":
      return [{ formaCount: "asc" as const }, { createdAt: "desc" as const }]
    case "forma-desc":
      return [{ formaCount: "desc" as const }, { createdAt: "desc" as const }]
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
    case "forma-asc":
      return Prisma.sql`"formaCount" ASC, "createdAt" DESC`
    case "forma-desc":
      return Prisma.sql`"formaCount" DESC, "createdAt" DESC`
    case "newest":
    default:
      return Prisma.sql`"createdAt" DESC`
  }
}

async function searchBuildIds(params: {
  q: string
  category: string | undefined
  item: string | undefined
  hasGuide: boolean
  hasShards: boolean
  baseFilter: Prisma.Sql
  sort: ListSort
  skip: number
  take: number
}): Promise<{ ids: string[]; total: number }> {
  const {
    q,
    category,
    item,
    hasGuide,
    hasShards,
    baseFilter,
    sort,
    skip,
    take,
  } = params
  // Cap at 8 tokens × 64 chars to bound query work on pathological input.
  // `[a-z0-9]+` already strips punctuation that would break to_tsquery syntax.
  const tokens = (q.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .slice(0, 8)
    .map((t) => t.slice(0, 64))
  if (tokens.length === 0) {
    return { ids: [], total: 0 }
  }
  const tsqueryStr = tokens.map((t) => `${t}:*`).join(" & ")
  const query = Prisma.sql`to_tsquery('english', ${tsqueryStr})`
  // ILIKE fallback only fires when searchVector is NULL (fresh dev DBs whose
  // trigger hasn't run). In production every row has a vector, so the planner
  // can use the GIN index on `searchVector` without an unindexed OR branch.
  const ilikeMatch = Prisma.sql`(${Prisma.join(
    tokens.map(
      (t) =>
        Prisma.sql`("name" ILIKE ${`%${t}%`} OR "itemName" ILIKE ${`%${t}%`} OR "description" ILIKE ${`%${t}%`})`,
    ),
    " AND ",
  )})`
  const matchFilter = Prisma.sql`("searchVector" @@ ${query} OR ("searchVector" IS NULL AND ${ilikeMatch}))`
  const categoryFilter = category
    ? Prisma.sql`AND "itemCategory" = ${category}`
    : Prisma.empty
  const itemFilter = item
    ? Prisma.sql`AND "itemUniqueName" = ${item}`
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
      WHERE ${matchFilter}
        AND ${baseFilter}
        ${categoryFilter}
        ${itemFilter}
        ${guideFilter}
        ${shardsFilter}
      ORDER BY ts_rank(COALESCE("searchVector", ''::tsvector), ${query}) DESC, ${tiebreaker}
      LIMIT ${take} OFFSET ${skip}
    `),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS n
      FROM builds
      WHERE ${matchFilter}
        AND ${baseFilter}
        ${categoryFilter}
        ${itemFilter}
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
  const { page, limit, q, category, item, hasGuide, hasShards } = filters
  const sort: ListSort = filters.sort ?? defaultSort
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { ...baseWhere }
  if (category) where.itemCategory = category
  if (item) where.itemUniqueName = item
  if (hasGuide) where.hasGuide = true
  if (hasShards) where.hasShards = true

  if (q) {
    const { ids, total } = await searchBuildIds({
      q,
      category,
      item,
      hasGuide,
      hasShards,
      baseFilter,
      sort,
      skip,
      take: limit,
    })
    if (ids.length === 0) {
      return { builds: [], total, page, limit }
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
      limit,
    }
  }

  const [rows, total] = await Promise.all([
    prisma.build.findMany({
      where,
      orderBy: orderByForSort(sort),
      skip,
      take: limit,
      select: LIST_SELECT,
    }),
    prisma.build.count({ where }),
  ])

  return {
    builds: rows.map(serializeListRow),
    total,
    page,
    limit,
  }
}
