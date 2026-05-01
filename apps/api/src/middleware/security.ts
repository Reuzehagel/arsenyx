import type { MiddlewareHandler } from "hono"

import { webOrigins } from "../env"
import { getSession } from "../lib/session"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function safeOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

// Reject mutating requests whose Origin (or Referer fallback) isn't a known
// web origin. Better Auth handles its own /auth/* CSRF; this guards the rest
// of the Hono routes that rely on session cookies.
export const originGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next()

  const origin = c.req.header("origin") ?? safeOrigin(c.req.header("referer"))
  if (!origin || !webOrigins.includes(origin)) {
    return c.json({ error: "forbidden_origin" }, 403)
  }
  return next()
}

// Reject mutating requests from banned users. Result is cached on the context
// so the downstream route's own getSession() call doesn't re-hit Better Auth.
export const banGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next()

  const session = await getSession(c)
  if (session?.user.isBanned) {
    return c.json({ error: "banned" }, 403)
  }
  return next()
}
