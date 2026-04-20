import { type Context, Hono } from "hono"

import { scrapeOverframeBuild } from "../lib/overframe/import"

export const imports = new Hono()

export async function handleOverframeImport(c: Context) {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "invalid_json" }, 400)
  }
  const url = (body as { url?: unknown } | null)?.url
  if (typeof url !== "string" || !url) {
    return c.json({ error: "missing_url" }, 400)
  }

  try {
    const result = await scrapeOverframeBuild(url)
    return c.json(result)
  } catch (err) {
    return c.json(
      {
        error: "scrape_failed",
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    )
  }
}

imports.post("/overframe", handleOverframeImport)
