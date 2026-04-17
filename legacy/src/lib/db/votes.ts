/**
 * Vote Database Operations
 *
 * Toggle votes and query vote status for builds
 */

import { prisma } from "../db"
import { voteLimiter, RateLimitError } from "../rate-limit"
import {
  toggleBuildSocialAction,
  getUserSocialStatusesForBuilds,
} from "./social-toggle"

// =============================================================================
// TYPES
// =============================================================================

export interface ToggleVoteResult {
  voted: boolean
  voteCount: number
}

// =============================================================================
// VOTE OPERATIONS
// =============================================================================

/**
 * Toggle vote for a build (add or remove)
 * Uses Prisma transaction to keep voteCount in sync
 *
 * @param userId - ID of the user voting
 * @param buildId - ID of the build being voted on
 * @returns New vote state and updated count
 * @throws {RateLimitError} If rate limit exceeded (10 votes/min)
 */
export async function toggleBuildVote(
  userId: string,
  buildId: string,
): Promise<ToggleVoteResult> {
  // Rate limit: 10 votes per minute per user
  await voteLimiter.check(10, `vote_${userId}`)

  const result = await toggleBuildSocialAction(
    userId,
    buildId,
    "buildVote",
    "voteCount",
  )
  return { voted: result.active, voteCount: result.count }
}

/**
 * Check if user has voted for a build
 */
export async function hasUserVotedForBuild(
  userId: string,
  buildId: string,
): Promise<boolean> {
  const vote = await prisma.buildVote.findUnique({
    where: {
      userId_buildId: { userId, buildId },
    },
  })
  return Boolean(vote)
}

/**
 * Get vote status for multiple builds (for list views)
 *
 * @param userId - ID of the user
 * @param buildIds - Array of build IDs to check
 * @returns Set of build IDs that the user has voted for
 */
export async function getUserVotesForBuilds(
  userId: string,
  buildIds: string[],
): Promise<Set<string>> {
  return getUserSocialStatusesForBuilds(userId, buildIds, "buildVote")
}

// Re-export for convenience
export { RateLimitError }
