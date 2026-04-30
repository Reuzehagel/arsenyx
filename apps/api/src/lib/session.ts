import type { Context } from "hono"

import { auth } from "../auth"

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

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
