import "server-only"
/**
 * Build Database Operations
 *
 * CRUD operations for builds with visibility checks
 */
import type { BuildVisibility, Prisma } from "@prisma/client"
import { nanoid } from "nanoid"
import { cache } from "react"

import { getFullItem } from "@/lib/warframe/items"
import { BuildStateSchema, safeParseOrCast } from "@/lib/warframe/schemas"
import type { BuildState } from "@/lib/warframe/types"

import { prisma } from "../db"

// =============================================================================
// TYPES
// =============================================================================

export interface CreateBuildInput {
  itemUniqueName: string
  itemCategory: string
  name: string
  description?: string | null
  visibility?: BuildVisibility
  buildData: BuildState
  guideSummary?: string
  guideDescription?: string
  partnerBuildIds?: string[]
  organizationId?: string
}

export interface UpdateBuildInput {
  name?: string
  description?: string | null
  visibility?: BuildVisibility
  buildData?: BuildState
  organizationId?: string | null
  // Guide fields
  guideSummary?: string | null
  guideDescription?: string | null
  partnerBuildIds?: string[]
}

export interface BuildWithUser {
  id: string
  slug: string
  name: string
  description: string | null
  visibility: BuildVisibility
  buildData: BuildState
  voteCount: number
  favoriteCount: number
  viewCount: number
  createdAt: Date
  updatedAt: Date
  userId: string
  user: {
    id: string
    name: string | null
    username: string | null
    displayUsername: string | null
    image: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
    image: string | null
  } | null
  item: {
    uniqueName: string
    name: string
    imageName: string | null
    browseCategory: string
  }
  // Guide
  buildGuide: {
    summary: string | null
    description: string | null
    updatedAt: Date
  } | null
  // Partner builds
  partnerBuilds: {
    id: string
    slug: string
    name: string
    item: {
      name: string
      imageName: string | null
      browseCategory: string
    }
    buildData: unknown
  }[]
}

export interface GetBuildsOptions {
  page?: number
  limit?: number
  sortBy?: "newest" | "votes" | "views" | "updated" | "popular"
  category?: string
  query?: string
  author?: string
  organizationId?: string
  hasGuide?: boolean
  hasShards?: boolean
}

/** Lightweight projection for build list pages (no buildData, guide, or partners) */
export interface BuildListItem {
  id: string
  slug: string
  name: string
  visibility: BuildVisibility
  voteCount: number
  viewCount: number
  createdAt: Date
  updatedAt: Date
  user: {
    name: string | null
    username: string | null
    displayUsername: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
  } | null
  item: {
    name: string
    imageName: string | null
    browseCategory: string
  }
}

function serializeBuildDataForDb(buildData: BuildState): Prisma.JsonObject {
  function cleanJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) =>
        item === undefined ? null : cleanJsonValue(item),
      )
    }

    if (value && typeof value === "object") {
      const cleaned: Record<string, unknown> = {}
      for (const [key, nestedValue] of Object.entries(value)) {
        if (nestedValue !== undefined) {
          cleaned[key] = cleanJsonValue(nestedValue)
        }
      }
      return cleaned
    }

    return value
  }

  // Prisma JSON fields cannot contain `undefined`; remove optional object fields
  // and use `null` for empty array slots.
  const sanitized = cleanJsonValue({
    ...buildData,
    arcaneSlots: (buildData.arcaneSlots ?? []).map((a) => a ?? null),
    shardSlots: (buildData.shardSlots ?? []).map((s) => s ?? null),
  })
  const parsed = BuildStateSchema.safeParse(sanitized)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(issue?.message ?? "Invalid buildData")
  }

  return cleanJsonValue(parsed.data) as Prisma.JsonObject
}

function detectHasShards(buildData: BuildState): boolean {
  return (buildData.shardSlots ?? []).some((s) => s !== null)
}

// =============================================================================
// SLUG GENERATION
// =============================================================================

/**
 * Generate a unique URL-friendly slug for a build
 * Uses nanoid with a custom alphabet for readability
 */
export function generateSlug(): string {
  // Use 10 characters - gives us 64^10 = ~1 quintillion unique combinations
  // Custom alphabet avoids confusing characters like 0/O, 1/l
  return nanoid(10)
}

/**
 * Generate a slug and ensure it's unique in the database
 */
async function generateUniqueSlug(): Promise<string> {
  let attempts = 0
  const maxAttempts = 5

  while (attempts < maxAttempts) {
    const slug = generateSlug()
    const existing = await prisma.build.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!existing) {
      return slug
    }

    attempts++
  }

  // Fallback: use cuid if nanoid keeps colliding (extremely unlikely)
  throw new Error("Failed to generate unique slug after multiple attempts")
}

// =============================================================================
// COMMON INCLUDES
// =============================================================================

const buildInclude = {
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
    select: {
      summary: true,
      description: true,
      updatedAt: true,
    },
  },
  partnerBuilds: {
    select: {
      id: true,
      slug: true,
      name: true,
      visibility: true,
      userId: true,
      buildData: true,
      itemUniqueName: true,
      itemName: true,
      itemImageName: true,
      itemCategory: true,
      organizationId: true,
    },
  },
} as const

/** Lightweight include for list endpoints — skips buildData parsing, guide, and partners */
const buildListSelect = {
  id: true,
  slug: true,
  name: true,
  visibility: true,
  voteCount: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      name: true,
      username: true,
      displayUsername: true,
    },
  },
  itemUniqueName: true,
  itemName: true,
  itemImageName: true,
  itemCategory: true,
  organizationId: true,
  organization: {
    select: { id: true, name: true, slug: true },
  },
} as const

async function mapBuildResult(
  build: {
    buildData: unknown
    buildGuide: {
      summary: string | null
      description: string | null
      updatedAt: Date
    } | null
    partnerBuilds: {
      id: string
      slug: string
      name: string
      visibility: BuildVisibility
      userId: string
      buildData: unknown
      itemUniqueName: string
      itemName: string
      itemImageName: string | null
      itemCategory: string
      organizationId: string | null
    }[]
    [key: string]: unknown
  },
  viewerId?: string,
): Promise<BuildWithUser> {
  // Filter partner builds based on visibility
  const filteredPartners = await filterVisiblePartnerBuilds(
    build.partnerBuilds,
    viewerId,
  )

  return {
    ...build,
    item: {
      uniqueName: build.itemUniqueName as string,
      name: build.itemName as string,
      imageName: (build.itemImageName as string | null) ?? null,
      browseCategory: build.itemCategory as string,
    },
    buildData: safeParseOrCast(
      BuildStateSchema,
      build.buildData,
      `build ${build.id} buildData`,
    ),
    buildGuide: build.buildGuide,
    partnerBuilds: filteredPartners.map((pb) => ({
      id: pb.id,
      slug: pb.slug,
      name: pb.name,
      item: {
        uniqueName: pb.itemUniqueName,
        name: pb.itemName,
        imageName: pb.itemImageName,
        browseCategory: pb.itemCategory,
      },
      buildData: safeParseOrCast(
        BuildStateSchema,
        pb.buildData,
        `partner build ${pb.id} buildData`,
      ),
    })),
  } as unknown as BuildWithUser
}

function mapBuildListItem(build: Record<string, unknown>): BuildListItem {
  return {
    ...build,
    item: {
      name: build.itemName as string,
      imageName: (build.itemImageName as string | null) ?? null,
      browseCategory: build.itemCategory as string,
    },
  } as BuildListItem
}

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new build
 */
export async function createBuild(
  userId: string,
  input: CreateBuildInput,
): Promise<BuildWithUser> {
  const item = getFullItem(
    input.itemCategory as Parameters<typeof getFullItem>[0],
    input.itemUniqueName,
  )
  if (!item) {
    throw new Error(
      `Item not found for category '${input.itemCategory}': ${input.itemUniqueName}`,
    )
  }

  const slug = await generateUniqueSlug()

  // Prepare guide data if provided
  const hasGuideData = input.guideSummary || input.guideDescription
  const guideCreate = hasGuideData
    ? {
        create: {
          summary: input.guideSummary ?? null,
          description: input.guideDescription ?? null,
        },
      }
    : undefined

  // Prepare partner builds connection if provided
  const partnerBuildsConnect =
    input.partnerBuildIds && input.partnerBuildIds.length > 0
      ? { connect: input.partnerBuildIds.map((id) => ({ id })) }
      : undefined

  const build = await prisma.build.create({
    data: {
      slug,
      userId,
      itemUniqueName: item.uniqueName,
      itemCategory: input.itemCategory,
      itemName: item.name,
      itemImageName: item.imageName ?? null,
      name: input.name,
      description: input.description,
      visibility: input.visibility ?? "PUBLIC",
      buildData: serializeBuildDataForDb(input.buildData),
      organizationId: input.organizationId ?? null,
      hasShards: detectHasShards(input.buildData),
      hasGuide: !!(input.guideSummary || input.guideDescription),
      buildGuide: guideCreate,
      partnerBuilds: partnerBuildsConnect,
    },
    include: buildInclude,
  })

  return mapBuildResult(build, userId)
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get a build by its slug with visibility checks
 * @param slug - The build's URL slug
 * @param viewerId - Optional ID of the user viewing (for visibility checks)
 */
export const getBuildBySlug = cache(async function getBuildBySlug(
  slug: string,
  viewerId?: string,
): Promise<BuildWithUser | null> {
  const build = await prisma.build.findUnique({
    where: { slug },
    include: buildInclude,
  })

  if (!build) {
    return null
  }

  // Visibility check
  if (!(await canViewBuild(build, viewerId))) {
    return null
  }

  return mapBuildResult(build, viewerId)
})

/**
 * Get a build by its ID with visibility checks
 */
export async function getBuildById(
  id: string,
  viewerId?: string,
): Promise<BuildWithUser | null> {
  const build = await prisma.build.findUnique({
    where: { id },
    include: buildInclude,
  })

  if (!build) {
    return null
  }

  // Visibility check
  if (!(await canViewBuild(build, viewerId))) {
    return null
  }

  return mapBuildResult(build, viewerId)
}

/**
 * Get all builds for a user (with visibility filtering for non-owners)
 */
export async function getUserBuilds(
  userId: string,
  viewerId?: string,
  options: GetBuildsOptions = {},
): Promise<{ builds: BuildListItem[]; total: number }> {
  const { page = 1, limit = 20, sortBy = "newest" } = options
  const skip = (page - 1) * limit

  // If viewer is the owner, show all builds
  // Otherwise, only show public/unlisted builds
  const isOwner = viewerId === userId
  const visibilityFilter: Prisma.BuildWhereInput = isOwner
    ? {}
    : { visibility: { in: ["PUBLIC", "UNLISTED"] } }

  const where: Prisma.BuildWhereInput = {
    userId,
    organizationId: null, // Exclude org builds from personal profile
    ...visibilityFilter,
    ...(options.category && {
      itemCategory: options.category,
    }),
  }

  // If there's a text query, use raw SQL for tsvector search
  if (options.query && options.query.trim().length >= 2) {
    return searchBuildsWithFilters(
      options.query.trim(),
      where,
      sortBy,
      skip,
      limit,
    )
  }

  const [builds, total] = await Promise.all([
    prisma.build.findMany({
      where,
      select: buildListSelect,
      orderBy: getOrderBy(sortBy),
      skip,
      take: limit,
    }),
    prisma.build.count({ where }),
  ])

  return { builds: builds.map(mapBuildListItem), total }
}

/**
 * Get public builds for a specific item
 */
export async function getPublicBuildsForItem(
  itemUniqueName: string,
  options: GetBuildsOptions = {},
): Promise<{ builds: BuildListItem[]; total: number }> {
  try {
    const { page = 1, limit = 20, sortBy = "popular" } = options
    const skip = (page - 1) * limit

    const where = {
      itemUniqueName,
      visibility: "PUBLIC" as const,
    }

    const [builds, total] = await Promise.all([
      prisma.build.findMany({
        where,
        select: buildListSelect,
        orderBy: getOrderBy(sortBy),
        skip,
        take: limit,
      }),
      prisma.build.count({ where }),
    ])

    return { builds: builds.map(mapBuildListItem), total }
  } catch {
    // Return empty during build time when DB is unavailable
    return { builds: [], total: 0 }
  }
}

/**
 * Get all public builds with optional category filter
 */
export async function getPublicBuilds(
  options: GetBuildsOptions = {},
): Promise<{ builds: BuildListItem[]; total: number }> {
  const {
    page = 1,
    limit = 20,
    sortBy = "newest",
    category,
    query,
    author,
    organizationId,
    hasGuide,
    hasShards,
  } = options
  const skip = (page - 1) * limit

  const where: Prisma.BuildWhereInput = {
    visibility: "PUBLIC",
    ...(category && {
      itemCategory: category,
    }),
    ...(author && {
      user: {
        username: { equals: author, mode: "insensitive" },
      },
    }),
    ...(organizationId && { organizationId }),
    ...(hasGuide === true && { hasGuide: true }),
    ...(hasShards === true && { hasShards: true }),
  }

  // If there's a text query, use raw SQL for tsvector search
  if (query && query.trim().length >= 2) {
    return searchBuildsWithFilters(query.trim(), where, sortBy, skip, limit)
  }

  const [builds, total] = await Promise.all([
    prisma.build.findMany({
      where,
      select: buildListSelect,
      orderBy: getOrderBy(sortBy),
      skip,
      take: limit,
    }),
    prisma.build.count({ where }),
  ])

  return { builds: builds.map(mapBuildListItem), total }
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update a build (owner only)
 */
export async function updateBuild(
  buildId: string,
  userId: string,
  input: UpdateBuildInput,
): Promise<BuildWithUser> {
  const existingBuild = await assertBuildAccess(buildId, userId)

  const updateData: Prisma.BuildUpdateInput = {}

  if (input.name !== undefined) {
    updateData.name = input.name
  }
  if (input.description !== undefined) {
    updateData.description = input.description
  }
  if (input.visibility !== undefined) {
    updateData.visibility = input.visibility
  }
  if (input.buildData !== undefined) {
    updateData.buildData = serializeBuildDataForDb(input.buildData)
    updateData.hasShards = detectHasShards(input.buildData)
  }
  if (input.organizationId !== undefined) {
    if (
      input.organizationId !== existingBuild.organizationId &&
      existingBuild.userId !== userId
    ) {
      throw new Error(
        "Only the build owner can move a build between personal and organization ownership",
      )
    }

    if (
      input.organizationId &&
      input.organizationId !== existingBuild.organizationId
    ) {
      const { isOrgMember } = await import("./organizations")
      if (!(await isOrgMember(input.organizationId, userId))) {
        throw new Error("You are not allowed to publish into this organization")
      }
    }

    updateData.organization = input.organizationId
      ? { connect: { id: input.organizationId } }
      : { disconnect: true }
  }

  // Handle guide summary and description
  const hasGuideUpdate =
    input.guideSummary !== undefined || input.guideDescription !== undefined
  if (hasGuideUpdate) {
    updateData.buildGuide = {
      upsert: {
        create: {
          summary: input.guideSummary ?? null,
          description: input.guideDescription ?? null,
        },
        update: {
          ...(input.guideSummary !== undefined && {
            summary: input.guideSummary,
          }),
          ...(input.guideDescription !== undefined && {
            description: input.guideDescription,
          }),
        },
      },
    }

    // Update denormalized hasGuide flag.
    // Only set to false when BOTH fields are explicitly null (clearing the guide).
    // If only one field is provided, the other may still have content in DB.
    if (input.guideSummary === null && input.guideDescription === null) {
      updateData.hasGuide = false
    } else if (input.guideSummary || input.guideDescription) {
      updateData.hasGuide = true
    }
    // If one field is undefined (not being updated), don't change hasGuide
  }

  // Handle partner builds update
  if (input.partnerBuildIds !== undefined) {
    await assertPartnerBuildAccess(input.partnerBuildIds, userId, buildId)

    updateData.partnerBuilds = {
      set: input.partnerBuildIds.map((id) => ({ id })),
    }
  }

  const build = await prisma.build.update({
    where: { id: buildId },
    data: updateData,
    include: buildInclude,
  })

  return mapBuildResult(build, userId)
}

/**
 * Increment the view count for a build
 */
export async function incrementBuildViewCount(buildId: string): Promise<void> {
  await prisma.build.update({
    where: { id: buildId },
    data: {
      viewCount: { increment: 1 },
    },
  })
}

/**
 * Get user's builds for partner build selector
 * Returns minimal info needed for the selector UI
 */
export async function getUserBuildsForPartnerSelector(userId: string): Promise<
  {
    id: string
    slug: string
    name: string
    item: {
      name: string
      imageName: string | null
      browseCategory: string
    }
    buildData: {
      formaCount: number
    }
  }[]
> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  })
  const organizationIds = memberships.map(
    (membership) => membership.organizationId,
  )

  const builds = await prisma.build.findMany({
    where: {
      OR: [
        { userId },
        ...(organizationIds.length > 0
          ? [{ organizationId: { in: organizationIds } }]
          : []),
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      buildData: true,
      itemName: true,
      itemImageName: true,
      itemCategory: true,
    },
    orderBy: { name: "asc" },
  })

  return builds.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    item: {
      name: b.itemName,
      imageName: b.itemImageName,
      browseCategory: b.itemCategory,
    },
    buildData: {
      formaCount: (b.buildData as { formaCount?: number })?.formaCount ?? 0,
    },
  }))
}

// =============================================================================
// DELETE
// =============================================================================

/**
 * Delete a build (owner only)
 */
export async function deleteBuild(
  buildId: string,
  userId: string,
): Promise<void> {
  await assertBuildAccess(buildId, userId)

  await prisma.build.delete({
    where: { id: buildId },
  })
}

// =============================================================================
// FULL-TEXT SEARCH
// =============================================================================

/**
 * Search builds using PostgreSQL full-text search with additional Prisma filters.
 * Uses $queryRaw for the tsvector query, then fetches full build data via Prisma.
 */
async function searchBuildsWithFilters(
  query: string,
  where: Prisma.BuildWhereInput,
  sortBy: string,
  skip: number,
  limit: number,
): Promise<{ builds: BuildListItem[]; total: number }> {
  // First, get matching build IDs via raw SQL full-text search
  const searchResults = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b.id
    FROM builds b
    WHERE b."searchVector" @@ plainto_tsquery('english', ${query})
      AND b.visibility = 'PUBLIC'
    ORDER BY ts_rank(b."searchVector", plainto_tsquery('english', ${query})) DESC
    LIMIT 200
  `

  const matchingIds = searchResults.map((r) => r.id)

  if (matchingIds.length === 0) {
    return { builds: [], total: 0 }
  }

  // Apply additional Prisma filters on the matched IDs
  const fullWhere: Prisma.BuildWhereInput = {
    ...where,
    id: { in: matchingIds },
  }

  const [builds, total] = await Promise.all([
    prisma.build.findMany({
      where: fullWhere,
      select: buildListSelect,
      orderBy: getOrderBy(
        sortBy as "newest" | "votes" | "views" | "updated" | "popular",
      ),
      skip,
      take: limit,
    }),
    prisma.build.count({ where: fullWhere }),
  ])

  return { builds: builds.map(mapBuildListItem), total }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Assert that a user has write access to a build (owner or org member).
 * Throws if the build doesn't exist or the user isn't authorized.
 */
async function assertBuildAccess(
  buildId: string,
  userId: string,
): Promise<{ userId: string; organizationId: string | null }> {
  const existing = await prisma.build.findUnique({
    where: { id: buildId },
    select: { userId: true, organizationId: true },
  })
  if (!existing) throw new Error("Build not found")

  const isOwner = existing.userId === userId
  if (isOwner) return existing

  if (existing.organizationId) {
    const { isOrgMember } = await import("./organizations")
    if (await isOrgMember(existing.organizationId, userId)) return existing
  }

  throw new Error("Not authorized")
}

/**
 * Check if a user can view a build based on visibility
 */
function canViewBuild(
  build: {
    visibility: BuildVisibility
    userId: string
    organizationId?: string | null
  },
  viewerId?: string,
): Promise<boolean> {
  // Owner can always view
  if (viewerId && build.userId === viewerId) {
    return Promise.resolve(true)
  }

  // Public and unlisted builds are viewable by anyone
  if (build.visibility === "PUBLIC" || build.visibility === "UNLISTED") {
    return Promise.resolve(true)
  }

  if (viewerId && build.organizationId) {
    return import("./organizations").then(({ isOrgMember }) =>
      isOrgMember(build.organizationId!, viewerId),
    )
  }

  return Promise.resolve(false)
}

async function filterVisiblePartnerBuilds<
  T extends {
    visibility: BuildVisibility
    userId: string
    organizationId?: string | null
  },
>(partnerBuilds: T[], viewerId?: string): Promise<T[]> {
  const visiblePartnerBuilds: T[] = []

  for (const partnerBuild of partnerBuilds) {
    if (await canViewBuild(partnerBuild, viewerId)) {
      visiblePartnerBuilds.push(partnerBuild)
    }
  }

  return visiblePartnerBuilds
}

async function assertPartnerBuildAccess(
  partnerBuildIds: string[],
  userId: string,
  currentBuildId?: string,
): Promise<void> {
  if (partnerBuildIds.length === 0) {
    return
  }

  const partnerBuilds = await prisma.build.findMany({
    where: {
      id: { in: partnerBuildIds },
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
    },
  })

  const partnerBuildsById = new Map(
    partnerBuilds.map((build) => [build.id, build]),
  )

  for (const partnerBuildId of partnerBuildIds) {
    const build = partnerBuildsById.get(partnerBuildId)
    if (!build) {
      throw new Error("Partner build not found")
    }

    if (build.id === currentBuildId) {
      throw new Error("A build cannot link to itself")
    }

    if (build.userId === userId) {
      continue
    }

    if (build.organizationId) {
      const { isOrgMember } = await import("./organizations")
      if (await isOrgMember(build.organizationId, userId)) {
        continue
      }
    }

    throw new Error("Can only link builds you can edit")
  }
}

/**
 * Get Prisma orderBy clause from sort option
 */
function getOrderBy(
  sortBy: "newest" | "votes" | "views" | "updated" | "popular",
): Prisma.BuildOrderByWithRelationInput {
  switch (sortBy) {
    case "popular":
    case "votes":
      return { voteCount: "desc" }
    case "views":
      return { viewCount: "desc" }
    case "updated":
      return { updatedAt: "desc" }
    case "newest":
    default:
      return { createdAt: "desc" }
  }
}
