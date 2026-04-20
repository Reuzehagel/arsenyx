import { Hono } from "hono"

import { env } from "../env.ts"
import { buildScreenshotUrls, purgeCfUrls } from "../lib/cf-purge.ts"
import { deleteObjectsByPrefix } from "../lib/r2.ts"

export const invalidateRoute = new Hono()

invalidateRoute.post("/invalidate", async (c) => {
  const secret = c.req.header("x-shared-secret")
  if (!secret || secret !== env.SHARED_SECRET) {
    return c.json({ error: "unauthorized" }, 401)
  }

  let body: { slug?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "invalid_json" }, 400)
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : ""
  if (!slug) return c.json({ error: "missing_slug" }, 400)

  await Promise.all([
    deleteObjectsByPrefix(`${slug}/`),
    purgeCfUrls(buildScreenshotUrls(slug)),
  ])

  return c.json({ ok: true })
})
