import type { Context } from "hono"

import { getSession } from "../lib/session"
import { hasPrismaCode } from "../lib/validate"

export type AdminUser = { id: string; isAdmin: boolean }

/** Prisma's "record not found" error (e.g. a delete/update whose `where`
 *  matched nothing). Thin alias over the general code probe in validate.ts. */
export function isPrismaNotFound(err: unknown): boolean {
  return hasPrismaCode(err, "P2025")
}

export async function requireAdmin(c: Context): Promise<AdminUser | Response> {
  const session = await getSession(c)
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (session.user.isAdmin !== true) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }
  return { id: session.user.id, isAdmin: true }
}
