/**
 * User Database Operations
 *
 * Profile queries and statistics
 */

import "server-only"
import { cache } from "react"

import { prisma } from "../db"

// =============================================================================
// TYPES
// =============================================================================

export interface UserProfile {
  id: string
  name: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
  bio: string | null
  createdAt: Date
  isVerified: boolean
  isCommunityLeader: boolean
  isModerator: boolean
  isAdmin: boolean
  isBanned: boolean
}

export interface UserProfileFull extends UserProfile {
  email: string
}

export interface UserStats {
  totalBuilds: number
  totalVotesReceived: number
  totalFavorites: number
}

// =============================================================================
// USER QUERIES
// =============================================================================

/**
 * Get user profile by username (case-insensitive)
 *
 * @param username - Username to look up
 * @returns User profile or null if not found
 */
export const getUserByUsername = cache(async function getUserByUsername(
  username: string,
): Promise<UserProfile | null> {
  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      image: true,
      bio: true,
      createdAt: true,
      isVerified: true,
      isCommunityLeader: true,
      isModerator: true,
      isAdmin: true,
      isBanned: true,
    },
  })

  return user
})

/**
 * Get user profile by ID
 *
 * @param userId - User ID to look up
 * @returns User profile or null if not found
 */
export const getUserById = cache(async function getUserById(
  userId: string,
): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      image: true,
      bio: true,
      createdAt: true,
      isVerified: true,
      isCommunityLeader: true,
      isModerator: true,
      isAdmin: true,
      isBanned: true,
    },
  })

  return user
})

/**
 * Get user statistics
 *
 * @param userId - User ID to get stats for
 * @returns Stats including total builds, votes received, and favorites made
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const [buildStats, totalFavorites] = await Promise.all([
    prisma.build.aggregate({
      where: { userId, visibility: "PUBLIC", organizationId: null },
      _count: { id: true },
      _sum: { voteCount: true },
    }),
    prisma.buildFavorite.count({ where: { userId } }),
  ])

  return {
    totalBuilds: buildStats._count.id,
    totalVotesReceived: buildStats._sum.voteCount ?? 0,
    totalFavorites,
  }
}

/**
 * Get public build count for a user
 *
 * @param userId - User ID to count builds for
 * @returns Number of public builds
 */
export async function getPublicBuildCountForUser(
  userId: string,
): Promise<number> {
  return prisma.build.count({
    where: { userId, visibility: "PUBLIC", organizationId: null },
  })
}

/**
 * Get full user profile for settings page (includes email)
 *
 * @param userId - User ID to look up
 * @returns Full user profile or null if not found
 */
export async function getUserForSettings(
  userId: string,
): Promise<UserProfileFull | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      image: true,
      bio: true,
      email: true,
      createdAt: true,
      isVerified: true,
      isCommunityLeader: true,
      isModerator: true,
      isAdmin: true,
      isBanned: true,
    },
  })
  return user
}

/**
 * Update user bio
 *
 * @param userId - User ID to update
 * @param bio - New bio value (null to clear)
 */
export async function updateUserBio(
  userId: string,
  bio: string | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { bio },
  })
}

/**
 * Check if a username is already taken (case-insensitive), excluding a specific user
 *
 * @param username - Username to check
 * @param excludeUserId - User ID to exclude from the check
 * @returns True if the username is taken by another user
 */
export async function isUsernameTaken(
  username: string,
  excludeUserId: string,
): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      id: { not: excludeUserId },
    },
    select: { id: true },
  })
  return !!existing
}
