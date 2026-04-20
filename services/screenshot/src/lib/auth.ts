import { createHash } from "node:crypto"

import type { Context } from "hono"

import { env } from "../env.ts"
import { pool } from "./db.ts"

// Keep in sync with apps/api/src/lib/api-keys.ts — the service runs in a
// Docker image with no workspace deps, so we can't import it directly.
const SCOPE_IMAGE_GENERATE = "image:generate"

export function isAllowedReferer(c: Context): boolean {
  if (env.ALLOWED_SCREENSHOT_ORIGINS.length === 0) return false
  const referer = c.req.header("referer")
  if (!referer) return false
  try {
    const origin = new URL(referer).origin.toLowerCase()
    return env.ALLOWED_SCREENSHOT_ORIGINS.includes(origin)
  } catch {
    return false
  }
}

function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export type PatAuthResult =
  | { ok: true; apiKeyId: string; userId: string }
  | { ok: false; status: 401 | 403; error: string }

export async function verifyPat(c: Context): Promise<PatAuthResult> {
  const header = c.req.header("authorization")
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "unauthorized" }
  }
  const token = header.slice(7).trim()
  if (!token) return { ok: false, status: 401, error: "unauthorized" }

  const { rows } = await pool.query<{
    id: string
    userId: string
    scopes: string[]
    isActive: boolean
    expiresAt: Date | null
  }>(
    `SELECT id, "userId", scopes, "isActive", "expiresAt"
     FROM "ApiKey"
     WHERE key = $1
     LIMIT 1`,
    [hashApiKey(token)],
  )

  const row = rows[0]
  if (!row || !row.isActive) {
    return { ok: false, status: 401, error: "invalid_key" }
  }
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, status: 401, error: "invalid_key" }
  }
  if (!row.scopes.includes(SCOPE_IMAGE_GENERATE)) {
    return { ok: false, status: 403, error: "insufficient_scope" }
  }
  return { ok: true, apiKeyId: row.id, userId: row.userId }
}
