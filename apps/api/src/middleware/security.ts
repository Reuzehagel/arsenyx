import type { MiddlewareHandler } from "hono"

import { webOrigins } from "../env"
import { getSession } from "../lib/session"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// Baseline hardening for every API response. Nothing served from this origin
// should ever be treated as a live document — it's the one holding the session
// cookies. Only fills in what a route hasn't set, so per-route overrides win
// (/img needs a laxer CSP to still render an image).
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  const h = c.res.headers
  try {
    if (!h.has("X-Content-Type-Options")) {
      h.set("X-Content-Type-Options", "nosniff")
    }
    if (!h.has("Content-Security-Policy")) {
      h.set(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'",
      )
    }
    if (!h.has("Referrer-Policy")) h.set("Referrer-Policy", "no-referrer")
  } catch {
    // Cache API responses have an immutable header guard. edge-cache.ts
    // re-wraps its hits so one shouldn't reach here, but a hardening
    // middleware must never 500 an otherwise-fine request.
  }
}

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
