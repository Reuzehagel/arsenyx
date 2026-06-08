import { nanoid } from "nanoid"

import { prisma } from "../db"
import { Prisma } from "../generated/prisma/client"

/**
 * The two viewer→Build social toggles (Like, Bookmark) share one atomic shape:
 * a single CTE that INSERTs/DELETEs the join row and moves the denormalized
 * counter on `builds` by the number of rows actually changed (0 or 1).
 * `INSERT … ON CONFLICT DO NOTHING` / `DELETE …` make rapid double-clicks
 * idempotent without a read-modify-write race, and `GREATEST(0, …)` floors the
 * counter. The only per-kind differences are the join table, the counter
 * column, and the `value` weight column that `build_likes` carries and
 * `build_bookmarks` does not — captured in SOCIAL below. Centralising the CTE
 * means the atomic counter logic lives in exactly one place to audit.
 */
export type SocialKind = "like" | "bookmark"

interface SocialSpec {
  /** Join table name. */
  table: string
  /** Denormalized counter column on `builds`. */
  counter: string
  /** INSERT column list (build_likes carries an extra `value`). */
  insertColumns: Prisma.Sql
  /** INSERT value tuple, matching `insertColumns`. */
  insertValues: (id: string, userId: string, buildId: string) => Prisma.Sql
}

// table / counter / column names are compile-time literals here — never request
// input — so interpolating them via Prisma.raw is injection-safe. The row
// values (id, userId, buildId) stay parameterised through Prisma.sql.
const SOCIAL: Record<SocialKind, SocialSpec> = {
  like: {
    table: "build_likes",
    counter: "likeCount",
    insertColumns: Prisma.raw(`id, "userId", "buildId", value, "createdAt"`),
    insertValues: (id, userId, buildId) =>
      Prisma.sql`${id}, ${userId}, ${buildId}, 1, NOW()`,
  },
  bookmark: {
    table: "build_bookmarks",
    counter: "bookmarkCount",
    insertColumns: Prisma.raw(`id, "userId", "buildId", "createdAt"`),
    insertValues: (id, userId, buildId) =>
      Prisma.sql`${id}, ${userId}, ${buildId}, NOW()`,
  },
}

/**
 * Add or remove the viewer's Like/Bookmark on a Build and return the resulting
 * denormalized count. `fallbackCount` is returned if the UPDATE yields no row
 * (it always should). Idempotent: re-adding / re-removing is a no-op that still
 * returns the current count.
 */
export async function toggleSocial(
  kind: SocialKind,
  action: "add" | "remove",
  buildId: string,
  userId: string,
  fallbackCount: number,
): Promise<number> {
  const spec = SOCIAL[kind]
  const table = Prisma.raw(spec.table)
  const counter = Prisma.raw(`"${spec.counter}"`)

  const query =
    action === "add"
      ? Prisma.sql`
          WITH inserted AS (
            INSERT INTO ${table} (${spec.insertColumns})
            VALUES (${spec.insertValues(nanoid(), userId, buildId)})
            ON CONFLICT ("userId", "buildId") DO NOTHING
            RETURNING 1
          )
          UPDATE builds
          SET ${counter} = ${counter} + (SELECT count(*)::int FROM inserted)
          WHERE id = ${buildId}
          RETURNING ${counter} AS count
        `
      : Prisma.sql`
          WITH deleted AS (
            DELETE FROM ${table}
            WHERE "userId" = ${userId} AND "buildId" = ${buildId}
            RETURNING 1
          )
          UPDATE builds
          SET ${counter} = GREATEST(0, ${counter} - (SELECT count(*)::int FROM deleted))
          WHERE id = ${buildId}
          RETURNING ${counter} AS count
        `

  const rows = await prisma.$queryRaw<{ count: number }[]>(query)
  return rows[0]?.count ?? fallbackCount
}
