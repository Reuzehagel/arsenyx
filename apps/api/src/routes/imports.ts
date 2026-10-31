import { type Context, Hono } from "hono"

import { scrapeOverframeFromNextData } from "../lib/overframe/import"
import { getSession } from "../lib/session"
import { parseJsonBody } from "../lib/validate"
import { rateLimitUser } from "../middleware/rate-limit"

export const imports = new Hono()

// __NEXT_DATA__ for a build page is large (sibling/related builds ride along).
// 1.5MB covers it while still bounding a storage-fill / DoS attempt.
const MAX_NEXT_DATA_BYTES = 1.5 * 1024 * 1024

// Paste/bookmarklet path: the caller hands us the __NEXT_DATA__ object lifted
// from their own (already-challenge-cleared) Overframe tab, so there's no
// server-side fetch and no 403. `url` is optional context for the source.
export async function handleOverframeRawImport(c: Context) {
  // Sign-in-only: keeps the heavy 1.5MB parse + tree-walk off the anon surface
  // (rateLimitUser is a no-op without a session, so this is the real gate).
  const session = await getSession(c)
  if (!session?.user) return c.json({ error: "unauthorized" }, 401)

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

imports.post(
  "/overframe/raw",
  rateLimitUser("import"),
  handleOverframeRawImport,
)
