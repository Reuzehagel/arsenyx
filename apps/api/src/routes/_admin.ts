import { auth } from "../auth"

export type AdminUser = { id: string; isAdmin: boolean }
export type PrivilegedUser = {
  id: string
  isAdmin: boolean
  isModerator: boolean
}

export function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    (err as { code?: string }).code === "P2025"
  )
}

export async function requireAdmin(c: {
  req: { raw: Request }
}): Promise<AdminUser | Response> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  const isAdmin = (session.user as { isAdmin?: boolean }).isAdmin === true
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }
  return { id: session.user.id, isAdmin: true }
}

export function getUserRoles(
  user: { id: string } & Record<string, unknown>,
): PrivilegedUser {
  return {
    id: user.id,
    isAdmin: user.isAdmin === true,
    isModerator: user.isModerator === true,
  }
}
