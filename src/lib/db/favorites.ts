/**
 * Favorite Database Operations
 *
 * Toggle favorites and query favorite status for builds
 */

import { BuildStateSchema, safeParseOrCast } from "@/lib/warframe/schemas"
import type { BuildState } from "@/lib/warframe/types"

import { prisma } from "../db"
import { favoriteLimiter, RateLimitError } from "../rate-limit"
import {
  toggleBuildSocialAction,
  getUserSocialStatusesForBuilds,
} from "./social-toggle"

// =============================================================================
// TYPES
// =============================================================================

export interface ToggleFavoriteResult {
  favorited: boolean
  favoriteCount: number
}

export interface FavoriteBuildWithDetails {
  id: string
  slug: string
  name: string
  description: string | null
  buildData: BuildState
  voteCount: number
  favoriteCount: number
  viewCount: number
  createdAt: Date
  user: {
    id: string
    name: string | null
    username: string | null
    displayUsername: string | null
    image: string | null
  }
  item: {
    uniqueName: string
    name: string
    imageName: string | null
    browseCategory: string
  }
}

// =============================================================================
// FAVORITE OPERATIONS
// =============================================================================

/**
 * Toggle favorite for a build (add or remove)
 * Uses Prisma transaction to keep favoriteCount in sync
 *
 * @param userId - ID of the user favoriting
 * @param buildId - ID of the build being favorited
 * @returns New favorite state and updated count
 * @throws {RateLimitError} If rate limit exceeded (20 favorites/min)
 */
export async function toggleBuildFavorite(
  userId: string,
  buildId: string,
): Promise<ToggleFavoriteResult> {
  // Rate limit: 20 favorites per minute per user
  await favoriteLimiter.check(20, `fav_${userId}`)

  const result = await toggleBuildSocialAction(
    userId,
    buildId,
    "buildFavorite",
    "favoriteCount",
  )
  return { favorited: result.active, favoriteCount: result.count }
}

/**
 * Check if user has favorited a build
 */
export async function hasUserFavoritedBuild(
  userId: string,
  buildId: string,
): Promise<boolean> {
  const favorite = await prisma.buildFavorite.findUnique({
    where: {
      userId_buildId: { userId, buildId },
    },
  })
  return Boolean(favorite)
}

/**
 * Get user's favorited builds with pagination
 *
 * @param userId - ID of the user
 * @param options - Pagination options
 * @returns Paginated list of favorited builds
 */
export async function getUserFavoriteBuilds(
  userId: string,
  options: { page?: number; limit?: number } = {},
): Promise<{ builds: FavoriteBuildWithDetails[]; total: number }> {
  const { page = 1, limit = 24 } = options
  const skip = (page - 1) * limit

  const [favorites, total] = await Promise.all([
    prisma.buildFavorite.findMany({
      where: { userId },
      include: {
        build: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            buildData: true,
            voteCount: true,
            favoriteCount: true,
            viewCount: true,
            createdAt: true,
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
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.buildFavorite.count({ where: { userId } }),
  ])

  // Transform to extract build data
  const builds: FavoriteBuildWithDetails[] = favorites.map((f) => ({
    id: f.build.id,
    slug: f.build.slug,
    name: f.build.name,
    description: f.build.description,
    buildData: safeParseOrCast(
      BuildStateSchema,
      f.build.buildData,
      `favorite build ${f.build.id} buildData`,
    ),
    voteCount: f.build.voteCount,
    favoriteCount: f.build.favoriteCount,
    viewCount: f.build.viewCount,
    createdAt: f.build.createdAt,
    user: f.build.user,
    item: {
      uniqueName: f.build.itemUniqueName,
      name: f.build.itemName,
      imageName: f.build.itemImageName,
      browseCategory: f.build.itemCategory,
    },
  }))

  return { builds, total }
}

/**
 * Get favorite status for multiple builds (for list views)
 *
 * @param userId - ID of the user
 * @param buildIds - Array of build IDs to check
 * @returns Set of build IDs that the user has favorited
 */
export async function getUserFavoritesForBuilds(
  userId: string,
  buildIds: string[],
): Promise<Set<string>> {
  return getUserSocialStatusesForBuilds(userId, buildIds, "buildFavorite")
}

// Re-export for convenience
export { RateLimitError }
