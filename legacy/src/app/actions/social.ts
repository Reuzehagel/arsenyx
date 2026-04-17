"use server"

/**
 * Social Feature Server Actions
 *
 * Vote and favorite operations with authentication
 */

import { revalidatePath } from "next/cache"

import { getServerSession } from "@/lib/auth"
import { requireAuth } from "@/lib/auth-helpers"
import {
  toggleBuildVote,
  hasUserVotedForBuild,
  toggleBuildFavorite,
  hasUserFavoritedBuild,
} from "@/lib/db/index"
import { RateLimitError } from "@/lib/rate-limit"
import { ok, err, type Result } from "@/lib/result"

// =============================================================================
// TYPES
// =============================================================================

export type VoteResult = Result<{ voted: boolean; voteCount: number }>
export type FavoriteResult = Result<{
  favorited: boolean
  favoriteCount: number
}>

export interface SocialStatusResult {
  hasVoted: boolean
  hasFavorited: boolean
}

// =============================================================================
// VOTE ACTIONS
// =============================================================================

/**
 * Toggle vote on a build
 */
export async function toggleVoteAction(buildId: string): Promise<VoteResult> {
  try {
    const auth = await requireAuth("vote")
    if (!auth.success) return auth

    const result = await toggleBuildVote(auth.data, buildId)

    // Revalidate build page to show updated count
    revalidatePath(`/builds/[slug]`, "page")

    return ok({ voted: result.voted, voteCount: result.voteCount })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return err("Too many votes. Please wait a moment.")
    }
    console.error("Failed to toggle vote:", error)
    return err("Failed to update vote")
  }
}

// =============================================================================
// FAVORITE ACTIONS
// =============================================================================

/**
 * Toggle favorite on a build
 */
export async function toggleFavoriteAction(
  buildId: string,
): Promise<FavoriteResult> {
  try {
    const auth = await requireAuth("save favorites")
    if (!auth.success) return auth

    const result = await toggleBuildFavorite(auth.data, buildId)

    // Revalidate relevant pages
    revalidatePath(`/builds/[slug]`, "page")
    revalidatePath("/favorites", "page")

    return ok({
      favorited: result.favorited,
      favoriteCount: result.favoriteCount,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return err("Too many favorites. Please wait a moment.")
    }
    console.error("Failed to toggle favorite:", error)
    return err("Failed to update favorite")
  }
}

// =============================================================================
// STATUS CHECKS
// =============================================================================

/**
 * Get current user's vote and favorite status for a build
 */
export async function getSocialStatusAction(
  buildId: string,
): Promise<SocialStatusResult> {
  const session = await getServerSession()

  if (!session?.user?.id) {
    return { hasVoted: false, hasFavorited: false }
  }

  const [hasVoted, hasFavorited] = await Promise.all([
    hasUserVotedForBuild(session.user.id, buildId),
    hasUserFavoritedBuild(session.user.id, buildId),
  ])

  return { hasVoted, hasFavorited }
}
