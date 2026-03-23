import "server-only"
/**
 * Build Database Operations
 *
 * CRUD operations for builds with visibility checks
 */
import type { BuildVisibility, Prisma } from "@prisma/client"
import { nanoid } from "nanoid"
import { cache } from "react"

import {
  BuildStateSchema,
  safeParseOrCast,
  safeParse,
} from "@/lib/warframe/schemas"
import type { BuildState } from "@/lib/warframe/types"

import { prisma } from "../db"

// =============================================================================
// TYPES
// =============================================================================

export interface CreateBuildInput {
  itemUniqueName: string
  name: string
  description?: string
  visibility?: BuildVisibility
  buildData: BuildState
  guideSummary?: string
  guideDescription?: string
  partnerBuildIds?: string[]
}

export interface UpdateBuildInput {
  name?: string
  description?: string
  visibility?: BuildVisibility
  buildData?: BuildState
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
    image: string | null
  }
  item: {
    id: string
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
  }
  item: {
    name: string
    imageName: string | null
    browseCategory: string
  }
}

function sanitizeBuildDataForDb(buildData: BuildState): Prisma.JsonObject {
  // Validate before writing — log warning if schema doesn't match
  safeParse(BuildStateSchema, buildData, "buildData write")

  // Prisma JSON fields cannot contain `undefined` values anywhere inside arrays.
  // Use `null` for empty slots.
  const sanitized = {
    ...buildData,
    arcaneSlots: (buildData.arcaneSlots ?? []).map((a) => a ?? null),
    shardSlots: (buildData.shardSlots ?? []).map((s) => s ?? null),
  }
  return sanitized as unknown as Prisma.JsonObject
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
      image: true,
    },
  },
  item: {
    select: {
      id: true,
      uniqueName: true,
      name: true,
      imageName: true,
      browseCategory: true,
    },
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
      item: {
        select: {
          name: true,
          imageName: true,
          browseCategory: true,
        },
      },
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
    },
  },
  item: {
    select: {
      name: true,
      imageName: true,
      browseCategory: true,
    },
  },
} as const

function mapBuildResult(
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
      item: { name: string; imageName: string | null; browseCategory: string }
    }[]
    [key: string]: unknown
  },
  viewerId?: string,
): BuildWithUser {
  // Filter partner builds based on visibility
  const filteredPartners = build.partnerBuilds.filter((partner) =>
    canViewBuild(partner, viewerId),
  )

  return {
    ...build,
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
      item: pb.item,
      buildData: safeParseOrCast(
        BuildStateSchema,
        pb.buildData,
        `partner build ${pb.id} buildData`,
      ),
    })),
  } as BuildWithUser
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
  // Parallelize independent lookups
  const [item, slug] = await Promise.all([
    prisma.item.findUnique({
      where: { uniqueName: input.itemUniqueName },
      select: { id: true },
    }),
    generateUniqueSlug(),
  ])

  if (!item) {
    throw new Error(`Item not found: ${input.itemUniqueName}`)
  }

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
      itemId: item.id,
      name: input.name,
      description: input.description,
      visibility: input.visibility ?? "PUBLIC",
      buildData: sanitizeBuildDataForDb(input.buildData),
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
  if (!canViewBuild(build, viewerId)) {
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
  if (!canViewBuild(build, viewerId)) {
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
    ...visibilityFilter,
    ...(options.category && {
      item: {
        browseCategory: options.category,
      },
    }),
  }

  // If there's a text query, use raw SQL for tsvector search
  if (options.query && options.query.trim().length >= 2) {
    return searchBuildsWithFilters(options.query.trim(), where, sortBy, skip, limit)
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

  return { builds, total }
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

    // Find the item first
    const item = await prisma.item.findUnique({
      where: { uniqueName: itemUniqueName },
      select: { id: true },
    })

    if (!item) {
      return { builds: [], total: 0 }
    }

    const where = {
      itemId: item.id,
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

    return { builds, total }
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
    hasGuide,
    hasShards,
  } = options
  const skip = (page - 1) * limit

  const where: Prisma.BuildWhereInput = {
    visibility: "PUBLIC",
    ...(category && {
      item: {
        browseCategory: category,
      },
    }),
    ...(author && {
      user: {
        username: { equals: author, mode: "insensitive" },
      },
    }),
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

  return { builds, total }
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
  // First verify ownership
  const existing = await prisma.build.findUnique({
    where: { id: buildId },
    select: { userId: true },
  })

  if (!existing) {
    throw new Error("Build not found")
  }

  if (existing.userId !== userId) {
    throw new Error("Not authorized to update this build")
  }

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
    updateData.buildData = sanitizeBuildDataForDb(input.buildData)
    updateData.hasShards = detectHasShards(input.buildData)
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
    // Verify all partner builds belong to the same user
    if (input.partnerBuildIds.length > 0) {
      const partnerBuilds = await prisma.build.findMany({
        where: {
          id: { in: input.partnerBuildIds },
          userId: userId, // Must be own builds
        },
        select: { id: true },
      })

      const validIds = new Set(partnerBuilds.map((b) => b.id))
      const invalidIds = input.partnerBuildIds.filter((id) => !validIds.has(id))

      if (invalidIds.length > 0) {
        throw new Error("Can only link to your own builds")
      }
    }

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
  const builds = await prisma.build.findMany({
    where: { userId },
    select: {
      id: true,
      slug: true,
      name: true,
      buildData: true,
      item: {
        select: {
          name: true,
          imageName: true,
          browseCategory: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  return builds.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    item: b.item,
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
  // First verify ownership
  const existing = await prisma.build.findUnique({
    where: { id: buildId },
    select: { userId: true },
  })

  if (!existing) {
    throw new Error("Build not found")
  }

  if (existing.userId !== userId) {
    throw new Error("Not authorized to delete this build")
  }

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

  return { builds, total }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a user can view a build based on visibility
 */
function canViewBuild(
  build: { visibility: BuildVisibility; userId: string },
  viewerId?: string,
): boolean {
  // Owner can always view
  if (viewerId && build.userId === viewerId) {
    return true
  }

  // Public and unlisted builds are viewable by anyone
  if (build.visibility === "PUBLIC" || build.visibility === "UNLISTED") {
    return true
  }

  // Private builds are only viewable by owner
  return false
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
