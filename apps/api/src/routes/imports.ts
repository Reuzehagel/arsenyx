import { Hono } from "hono"

import { scrapeOverframeFromNextData } from "../lib/overframe/import"
import { requireUser } from "../lib/session"
import { parseJsonBody } from "../lib/validate"
import { rateLimitUser } from "../middleware/rate-limit"

export const imports = new Hono()

// __NEXT_DATA__ for a build page is large (sibling/related builds ride along).
// 1.5MB covers it while still bounding a storage-fill / DoS attempt.
const MAX_NEXT_DATA_BYTES = 1.5 * 1024 * 1024

// Paste/bookmarklet path: the caller hands us the __NEXT_DATA__ object lifted
// from their own (already-challenge-cleared) Overframe tab, so there's no
// server-side fetch and no 403. `url` is optional context for the source.
imports.post("/overframe/raw", rateLimitUser("import"), async (c) => {
  // Sign-in-only: keeps the heavy 1.5MB parse + tree-walk off the anon surface
  // (rateLimitUser is a no-op without a session, so this is the real gate).
  await requireUser(c)

  const { nextData, url } = await parseJsonBody(c, {
    maxBytes: MAX_NEXT_DATA_BYTES,
  })
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
})
