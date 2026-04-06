import "server-only"

import { prisma } from "../db"

// =============================================================================
// TYPES
// =============================================================================

export interface AdminUser {
  id: string
  name: string | null
  username: string | null
  displayUsername: string | null
  email: string
  image: string | null
  createdAt: Date
  isVerified: boolean
  isCommunityLeader: boolean
  isModerator: boolean
  isAdmin: boolean
  isBanned: boolean
  _count: { builds: number }
}

export interface AdminBuild {
  id: string
  slug: string
  name: string
  itemName: string
  itemCategory: string
  voteCount: number
  favoriteCount: number
  createdAt: Date
  user: { id: string; name: string | null; username: string | null }
}

export interface AdminStats {
  totalUsers: number
  totalBuilds: number
  buildsByCategory: { itemCategory: string; _count: number }[]
  buildsToday: number
  buildsThisWeek: number
  buildsThisMonth: number
}

// =============================================================================
// USER QUERIES
// =============================================================================

const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  email: true,
  image: true,
  createdAt: true,
  isVerified: true,
  isCommunityLeader: true,
  isModerator: true,
  isAdmin: true,
  isBanned: true,
  _count: { select: { builds: true } },
} as const

export async function getAdminUsers(search?: string): Promise<AdminUser[]> {
  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: ADMIN_USER_SELECT,
    orderBy: { createdAt: "desc" },
    take: 200,
  })
}

export async function adminUpdateUserRoles(
  userId: string,
  flags: {
    isVerified?: boolean
    isCommunityLeader?: boolean
    isModerator?: boolean
    isAdmin?: boolean
  },
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: flags,
  })
}

export async function adminBanUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { isBanned: true },
    }),
    prisma.session.deleteMany({
      where: { userId },
    }),
  ])
}

export async function adminUnbanUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false },
  })
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.build.deleteMany({ where: { userId } }),
    prisma.buildVote.deleteMany({ where: { userId } }),
    prisma.buildFavorite.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.organizationMember.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted User",
        email: `deleted-${userId}@arsenyx.local`,
        username: null,
        displayUsername: null,
        image: null,
        bio: null,
        isBanned: true,
        isVerified: false,
        isCommunityLeader: false,
        isModerator: false,
        isAdmin: false,
      },
    }),
  ])
}

// =============================================================================
// BUILD QUERIES
// =============================================================================

export async function getAdminBuilds(search?: string): Promise<AdminBuild[]> {
  return prisma.build.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            {
              user: { username: { contains: search, mode: "insensitive" } },
            },
          ],
        }
      : undefined,
    select: {
      id: true,
      slug: true,
      name: true,
      itemName: true,
      itemCategory: true,
      voteCount: true,
      favoriteCount: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
}

export async function adminDeleteBuild(buildId: string): Promise<void> {
  await prisma.build.delete({ where: { id: buildId } })
}

// =============================================================================
// STATS QUERIES
// =============================================================================

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    totalUsers,
    totalBuilds,
    buildsByCategory,
    buildsToday,
    buildsThisWeek,
    buildsThisMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.build.count(),
    prisma.build.groupBy({
      by: ["itemCategory"],
      _count: true,
      orderBy: { _count: { itemCategory: "desc" } },
    }),
    prisma.build.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.build.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.build.count({ where: { createdAt: { gte: startOfMonth } } }),
  ])

  return {
    totalUsers,
    totalBuilds,
    buildsByCategory: buildsByCategory.map((b) => ({
      itemCategory: b.itemCategory,
      _count: b._count,
    })),
    buildsToday,
    buildsThisWeek,
    buildsThisMonth,
  }
}

export async function getTopBuilds(limit = 10) {
  return prisma.build.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      itemName: true,
      voteCount: true,
      favoriteCount: true,
      user: { select: { name: true, username: true } },
    },
    orderBy: { voteCount: "desc" },
    take: limit,
  })
}

export async function getTopUsers(limit = 10) {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      _count: { select: { builds: true } },
    },
    orderBy: { builds: { _count: "desc" } },
    take: limit,
  })
}

export async function getRecentUsers(limit = 10) {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

// =============================================================================
// DEV TOOLS QUERIES
// =============================================================================

export async function getDbTableCounts(): Promise<Record<string, number>> {
  const [
    users,
    builds,
    buildVotes,
    buildFavorites,
    buildGuides,
    buildLinks,
    organizations,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.build.count(),
    prisma.buildVote.count(),
    prisma.buildFavorite.count(),
    prisma.buildGuide.count(),
    prisma.buildLink.count(),
    prisma.organization.count(),
  ])

  return {
    users,
    builds,
    buildVotes,
    buildFavorites,
    buildGuides,
    buildLinks,
    organizations,
  }
}
