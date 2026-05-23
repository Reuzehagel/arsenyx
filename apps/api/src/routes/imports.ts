import { type Context, Hono } from "hono"

import { scrapeOverframeBuild } from "../lib/overframe/import"
import { parseJsonBody } from "../lib/validate"
import { rateLimitUser } from "../middleware/rate-limit"

export const imports = new Hono()

export async function handleOverframeImport(c: Context) {
  // Tiny cap — this endpoint only takes a URL.
  const parsed = await parseJsonBody(c, { maxBytes: 4 * 1024 })
  if (!parsed.ok) return parsed.response
  const url = parsed.value.url
  if (typeof url !== "string" || !url) {
    return c.json({ error: "missing_url" }, 400)
  }

  try {
    const result = await scrapeOverframeBuild(url)
    return c.json(result)
  } catch (err) {
    // Log full error server-side for debugging; the raw message can leak
    // internal hostnames, IPs, or stack traces if echoed back to the client.
    console.error("overframe scrape failed:", err)
    return c.json({ error: "scrape_failed" }, 500)
  }
}

imports.post("/overframe", rateLimitUser("import"), handleOverframeImport)
