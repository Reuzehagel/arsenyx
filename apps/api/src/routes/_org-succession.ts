import { prisma } from "../db"

/**
 * Before deleting a user, promote the longest-standing remaining member of
 * every org where they are the only ADMIN. The FK cascade on
 * organization_members skips orgs.ts' last-admin guard, and no admin route can
 * appoint an org ADMIN, so without this the org is left unmanageable.
 * Orgs with no other members are left as they are.
 */
export function promoteOrgSuccessors(userId: string) {
  return prisma.$executeRaw`
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
  `
}
