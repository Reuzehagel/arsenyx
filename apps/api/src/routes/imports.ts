import { type Context, Hono } from "hono"

import {
  scrapeOverframeBuild,
  scrapeOverframeFromNextData,
} from "../lib/overframe/import"
import { parseJsonBody } from "../lib/validate"
import { rateLimitUser } from "../middleware/rate-limit"

export const imports = new Hono()

// __NEXT_DATA__ for a build page is large (sibling/related builds ride along),
// so the paste endpoint needs far more headroom than the URL endpoint. 1.5MB
// comfortably covers it while still bounding a storage-fill / DoS attempt.
const MAX_NEXT_DATA_BYTES = 1.5 * 1024 * 1024

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

// Paste/bookmarklet path: the caller hands us the __NEXT_DATA__ object lifted
// from their own (already-challenge-cleared) Overframe tab, so there's no
// server-side fetch and no 403. `url` is optional context for the source.
export async function handleOverframeRawImport(c: Context) {
  const parsed = await parseJsonBody(c, { maxBytes: MAX_NEXT_DATA_BYTES })
  if (!parsed.ok) return parsed.response
  const nextData = parsed.value.nextData
  const url = parsed.value.url
  if (!nextData || typeof nextData !== "object") {
    return c.json({ error: "missing_next_data" }, 400)
  }

  try {
    const result = scrapeOverframeFromNextData(
      nextData,
      typeof url === "string" ? url : undefined,
    )
    return c.json(result)
  } catch (err) {
    console.error("overframe raw import failed:", err)
    return c.json({ error: "scrape_failed" }, 500)
  }
}

imports.post("/overframe", rateLimitUser("import"), handleOverframeImport)
imports.post(
  "/overframe/raw",
  rateLimitUser("import"),
  handleOverframeRawImport,
)
