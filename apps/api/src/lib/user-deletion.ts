import { prisma } from "../db"

/**
 * The writes that must land before a user row is deleted, for both deletion
 * paths (Better Auth's /auth/delete-user hook and DELETE /admin/users/:id).
 * Run them in one transaction, ahead of (or with) the delete itself.
 *
 * - Likes, Dislikes and Bookmarks come back off the denormalized counters:
 *   the FK cascade would drop the rows but leave every counter they moved
 *   permanently inflated.
 * - In every org where the user is the only ADMIN, the longest-standing
 *   remaining member is promoted. The cascade on organization_members skips
 *   orgs.ts' last-admin guard, and no admin route can appoint an org ADMIN, so
 *   the org would otherwise be left unmanageable. Orgs with no other members
 *   are left as they are.
 * - Tombstones of builds the user authored (build_deletions) go too: account
 *   deletion means their content is gone, not kept for the 90-day window.
 */
export function beforeUserDeletion(userId: string) {
  return [
    prisma.$executeRaw`DELETE FROM build_deletions WHERE build->>'userId' = ${userId}`,
    prisma.$executeRaw`
      WITH deleted AS (
        DELETE FROM build_likes WHERE "userId" = ${userId}
        RETURNING "buildId", value
      )
      UPDATE builds b
      SET "likeCount" = GREATEST(0, b."likeCount" - (d.value = 1)::int),
          "dislikeCount" = GREATEST(0, b."dislikeCount" - (d.value = -1)::int)
      FROM deleted d
      WHERE b.id = d."buildId"
    `,
    prisma.$executeRaw`
      WITH deleted AS (
        DELETE FROM build_bookmarks WHERE "userId" = ${userId} RETURNING "buildId"
      )
      UPDATE builds
      SET "bookmarkCount" = GREATEST(0, "bookmarkCount" - 1)
      WHERE id IN (SELECT "buildId" FROM deleted)
    `,
    prisma.$executeRaw`
      UPDATE organization_members m
      SET role = 'ADMIN'
      FROM (
        SELECT DISTINCT ON (om."organizationId") om."organizationId", om."userId"
        FROM organization_members om
        WHERE om."userId" <> ${userId}
          AND om."organizationId" IN (
            SELECT "organizationId" FROM organization_members
            WHERE "userId" = ${userId} AND role = 'ADMIN'
          )
          AND NOT EXISTS (
            SELECT 1 FROM organization_members a
            WHERE a."organizationId" = om."organizationId"
              AND a.role = 'ADMIN' AND a."userId" <> ${userId}
          )
        ORDER BY om."organizationId", om."joinedAt", om."userId"
      ) next
      WHERE m."organizationId" = next."organizationId"
        AND m."userId" = next."userId"
    `,
  ]
}
