/**
 * Generic Social Toggle Helper
 *
 * Consolidates the identical DB logic for vote and favorite toggles.
 * Rate limiting stays in the caller (votes.ts / favorites.ts).
 */

import { prisma } from "@/lib/db"

type ToggleTable = "buildVote" | "buildFavorite"
type CountField = "voteCount" | "favoriteCount"

export interface ToggleResult {
  active: boolean
  count: number
}

/**
 * Generic toggle for user-build social actions (vote, favorite).
 * Checks for existing record, creates or deletes it, and updates the denormalized count.
 */
export async function toggleBuildSocialAction(
  userId: string,
  buildId: string,
  table: ToggleTable,
  countField: CountField,
): Promise<ToggleResult> {
  const model = prisma[table] as any
  const compositeKey = { userId_buildId: { userId, buildId } }

  const existing = await model.findUnique({ where: compositeKey })

  if (existing) {
    const results = await prisma.$transaction([
      model.delete({ where: { id: existing.id } }),
      prisma.build.update({
        where: { id: buildId },
        data: { [countField]: { decrement: 1 } },
        select: { [countField]: true },
      }),
    ])
    const build = results[1] as unknown as Record<string, number>
    return { active: false, count: build[countField] }
  } else {
    const results = await prisma.$transaction([
      model.create({ data: { userId, buildId } }),
      prisma.build.update({
        where: { id: buildId },
        data: { [countField]: { increment: 1 } },
        select: { [countField]: true },
      }),
    ])
    const build = results[1] as unknown as Record<string, number>
    return { active: true, count: build[countField] }
  }
}

/**
 * Generic batch query for user social statuses on multiple builds.
 */
export async function getUserSocialStatusesForBuilds(
  userId: string,
  buildIds: string[],
  table: ToggleTable,
): Promise<Set<string>> {
  if (buildIds.length === 0) return new Set()

  const model = prisma[table] as any
  const records = await model.findMany({
    where: { userId, buildId: { in: buildIds } },
    select: { buildId: true },
  })

  return new Set(records.map((r: { buildId: string }) => r.buildId))
}
