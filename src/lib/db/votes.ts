/**
 * Vote Database Operations
 *
 * Toggle votes and query vote status for builds
 */

import { prisma } from "../db"
import { voteLimiter, RateLimitError } from "../rate-limit"

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

  const existingVote = await prisma.buildVote.findUnique({
    where: {
      userId_buildId: { userId, buildId },
    },
  })

  if (existingVote) {
    // Remove vote
    const [, build] = await prisma.$transaction([
      prisma.buildVote.delete({ where: { id: existingVote.id } }),
      prisma.build.update({
        where: { id: buildId },
        data: { voteCount: { decrement: 1 } },
        select: { voteCount: true },
      }),
    ])
    return { voted: false, voteCount: build.voteCount }
  } else {
    // Add vote
    const [, build] = await prisma.$transaction([
      prisma.buildVote.create({ data: { userId, buildId } }),
      prisma.build.update({
        where: { id: buildId },
        data: { voteCount: { increment: 1 } },
        select: { voteCount: true },
      }),
    ])
    return { voted: true, voteCount: build.voteCount }
  }
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
  if (buildIds.length === 0) return new Set()

  const votes = await prisma.buildVote.findMany({
    where: {
      userId,
      buildId: { in: buildIds },
    },
    select: { buildId: true },
  })

  return new Set(votes.map((v) => v.buildId))
}

// Re-export for convenience
export { RateLimitError }
