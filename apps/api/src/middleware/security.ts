import type { MiddlewareHandler } from "hono"

import { auth } from "../auth"
import { webOrigins } from "../env"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Reject mutating requests whose Origin (or Referer fallback) isn't a known
// web origin. Better Auth handles its own /auth/* CSRF; this guards the rest
// of the Hono routes that rely on session cookies.
export const originGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next()

  const origin = c.req.header("origin")
  if (origin) {
    if (!webOrigins.includes(origin)) {
      return c.json({ error: "forbidden_origin" }, 403)
    }
    return next()
  }

  const referer = c.req.header("referer")
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin
      if (!webOrigins.includes(refOrigin)) {
        return c.json({ error: "forbidden_origin" }, 403)
      }
      return next()
    } catch {
      return c.json({ error: "forbidden_origin" }, 403)
    }
  }

  return c.json({ error: "forbidden_origin" }, 403)
}

// Reject mutating requests from banned users.
export const banGuard: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next()

  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (session?.user && (session.user as { isBanned?: boolean }).isBanned) {
    return c.json({ error: "banned" }, 403)
  }
  return next()
}
