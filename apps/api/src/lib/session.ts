import type { Context } from "hono"

import { auth } from "../auth"
import { httpError } from "./validate"

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
export type SessionUser = NonNullable<AuthSession>["user"]

// Per-request session cache. Multiple middleware/route handlers can ask for
// the session in a single request (e.g. banGuard then the route itself);
// without this, each call hits the Better Auth cookie-cache lookup again.
const SESSION_KEY = "session"

type Cached = { value: AuthSession }

export async function getSession(c: Context): Promise<AuthSession> {
  const cached = c.get(SESSION_KEY) as Cached | undefined
  if (cached) return cached.value
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  c.set(SESSION_KEY, { value: session } satisfies Cached)
  return session
}

/** Session read past the 60s cookie cache, for checks that must see a ban or
 *  admin demotion immediately (and a ban's deleted sessions). Replaces the
 *  per-request cache so later getSession() calls see the same fresh value. */
export async function getFreshSession(c: Context): Promise<AuthSession> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  })
  c.set(SESSION_KEY, { value: session } satisfies Cached)
  return session
}

/** The signed-in user, or a thrown 401 `{ error: "unauthorized" }`. */
export async function requireUser(c: Context): Promise<SessionUser> {
  const session = await getSession(c)
  if (!session?.user) throw httpError(401, "unauthorized")
  return session.user
}

/** Whether the viewer is an admin right now. Re-checked past the cookie
 *  cache so a demoted admin loses the power at once; only a cached admin pays
 *  the extra lookup. */
export async function isCurrentAdmin(c: Context): Promise<boolean> {
  const session = await getSession(c)
  if (session?.user.isAdmin !== true) return false
  return (await getFreshSession(c))?.user.isAdmin === true
}

/** The acting admin, or a thrown 401/403. Fresh, not cookie-cached: a
 *  just-demoted admin must not get a 60s window to re-promote themselves or
 *  act against the admin who demoted them. */
export async function requireAdmin(c: Context): Promise<{ id: string }> {
  const session = await getFreshSession(c)
  if (!session?.user) throw httpError(401, "unauthorized")
  if (session.user.isAdmin !== true) throw httpError(403, "forbidden")
  return { id: session.user.id }
}
