import { nanoid } from "nanoid"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"

/**
 * The viewer→Build social toggles (Like/Dislike, Bookmark) share one atomic shape: a
 * single CTE that writes the join row and moves the denormalized counter(s) on
 * `builds` by the number of rows actually changed (0 or 1). `ON CONFLICT` /
 * `DELETE …` make rapid double-clicks idempotent without a read-modify-write
 * race, and `GREATEST(0, …)` floors every decrement. Keeping the CTEs here
 * means the atomic counter logic lives in exactly one file to audit.
 */

export type LikeValue = 1 | -1

export type LikeCounts = { likeCount: number; dislikeCount: number }

// Compile-time literals only — never request input — so Prisma.raw is safe.
const LIKE_COUNTER: Record<LikeValue, Prisma.Sql> = {
  1: Prisma.raw(`"likeCount"`),
  [-1]: Prisma.raw(`"dislikeCount"`),
}

/**
 * Set the viewer's Like (1) or Dislike (-1) on a Build (one `build_likes` row),
 * flipping the opposite one if it exists, and return both counts. Re-sending
 * the same value is a no-op. `xmax = 0` is Postgres' tell for "this row was
 * inserted, not updated": a fresh row only bumps its own counter, a flip also
 * takes one off the other.
 */
export async function setLike(
  value: LikeValue,
  buildId: string,
  userId: string,
  fallback: LikeCounts,
): Promise<LikeCounts> {
  const own = LIKE_COUNTER[value]
  const other = LIKE_COUNTER[value === 1 ? -1 : 1]
  const rows = await prisma.$queryRaw<LikeCounts[]>`
    WITH up AS (
      INSERT INTO build_likes (id, "userId", "buildId", value, "createdAt")
      VALUES (${nanoid()}, ${userId}, ${buildId}, ${value}, NOW())
      ON CONFLICT ("userId", "buildId") DO UPDATE SET value = EXCLUDED.value
      WHERE build_likes.value <> EXCLUDED.value
      RETURNING (xmax = 0) AS inserted
    )
    UPDATE builds
    SET ${own} = ${own} + (SELECT count(*)::int FROM up),
        ${other} = GREATEST(0, ${other} - (SELECT count(*)::int FROM up WHERE NOT inserted))
    WHERE id = ${buildId}
    RETURNING "likeCount", "dislikeCount"
  `
  return rows[0] ?? fallback
}

/** Remove the viewer's Like or Dislike and return both counts. */
export async function clearLike(
  buildId: string,
  userId: string,
  fallback: LikeCounts,
): Promise<LikeCounts> {
  const rows = await prisma.$queryRaw<LikeCounts[]>`
    WITH deleted AS (
      DELETE FROM build_likes
      WHERE "userId" = ${userId} AND "buildId" = ${buildId}
      RETURNING value
    )
    UPDATE builds
    SET "likeCount" = GREATEST(0, "likeCount" - (SELECT count(*)::int FROM deleted WHERE value = 1)),
        "dislikeCount" = GREATEST(0, "dislikeCount" - (SELECT count(*)::int FROM deleted WHERE value = -1))
    WHERE id = ${buildId}
    RETURNING "likeCount", "dislikeCount"
  `
  return rows[0] ?? fallback
}

/**
 * Add or remove the viewer's Bookmark on a Build and return the resulting
 * count. Idempotent: re-adding / re-removing is a no-op that still returns the
 * current count.
 */
export async function toggleBookmark(
  action: "add" | "remove",
  buildId: string,
  userId: string,
  fallbackCount: number,
): Promise<number> {
  const query =
    action === "add"
      ? Prisma.sql`
          WITH inserted AS (
            INSERT INTO build_bookmarks (id, "userId", "buildId", "createdAt")
            VALUES (${nanoid()}, ${userId}, ${buildId}, NOW())
            ON CONFLICT ("userId", "buildId") DO NOTHING
            RETURNING 1
          )
          UPDATE builds
          SET "bookmarkCount" = "bookmarkCount" + (SELECT count(*)::int FROM inserted)
          WHERE id = ${buildId}
          RETURNING "bookmarkCount" AS count
        `
      : Prisma.sql`
          WITH deleted AS (
            DELETE FROM build_bookmarks
            WHERE "userId" = ${userId} AND "buildId" = ${buildId}
            RETURNING 1
          )
          UPDATE builds
          SET "bookmarkCount" = GREATEST(0, "bookmarkCount" - (SELECT count(*)::int FROM deleted))
          WHERE id = ${buildId}
          RETURNING "bookmarkCount" AS count
        `

  const rows = await prisma.$queryRaw<{ count: number }[]>(query)
  return rows[0]?.count ?? fallbackCount
}

/**
 * Remove a user's Likes, Dislikes and Bookmarks and take them back off the counters.
 * Run before deleting the user: the FK cascade would drop the rows but leave
 * every counter they moved permanently inflated.
 */
export function releaseUserSocial(userId: string) {
  return [
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
  ]
}
