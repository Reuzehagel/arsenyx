import { Hono, type Context } from "hono"

import { prisma } from "../db"
import {
  ALL_API_KEY_SCOPES,
  type ApiKeyListItem,
  ApiKeyLimitExceededError,
  createApiKey,
  listApiKeysForUser,
  PRIVILEGED_API_KEY_SCOPES,
  revokeApiKey,
} from "../lib/api-keys"
import { getSession } from "../lib/session"
import { parseJsonBody } from "../lib/validate"
import { getUserRoles } from "./_admin"

const KNOWN_SCOPES = new Set<string>(ALL_API_KEY_SCOPES)
const PRIVILEGED_SCOPES = new Set<string>(PRIVILEGED_API_KEY_SCOPES)

export const me = new Hono()

const MAX_API_KEY_NAME = 100

async function requireSession(c: Context) {
  const session = await getSession(c)
  if (!session?.user) return null
  return session.user
}

function serializeApiKey(k: ApiKeyListItem) {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    rateLimit: k.rateLimit,
    isActive: k.isActive,
    createdAt: k.createdAt.toISOString(),
    expiresAt: k.expiresAt?.toISOString() ?? null,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  }
}

me.get("/builds/export", async (c) => {
  const user = await requireSession(c)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const builds = await prisma.build.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      itemUniqueName: true,
      itemCategory: true,
      itemName: true,
      itemImageName: true,
      name: true,
      description: true,
      visibility: true,
      buildData: true,
      hasShards: true,
      hasGuide: true,
      createdAt: true,
      updatedAt: true,
      forkedFromId: true,
      organizationId: true,
    },
  })

  const date = new Date().toISOString().slice(0, 10)
  const payload = {
    exportedAt: new Date().toISOString(),
    userId: user.id,
    count: builds.length,
    builds,
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="arsenyx-builds-${date}.json"`,
    },
  })
})

me.get("/api-keys", async (c) => {
  const user = await requireSession(c)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const keys = await listApiKeysForUser(user.id)
  return c.json({ apiKeys: keys.map(serializeApiKey) })
})

me.post("/api-keys", async (c) => {
  const user = await requireSession(c)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const parsed = await parseJsonBody(c, { maxBytes: 4 * 1024 })
  if (!parsed.ok) return parsed.response
  const b = parsed.value

  const rawName = typeof b.name === "string" ? b.name.trim() : ""
  if (!rawName) return c.json({ error: "invalid_name" }, 400)
  const name = rawName.slice(0, MAX_API_KEY_NAME)

  let expiresAt: Date | null = null
  if (b.expiresAt != null) {
    if (typeof b.expiresAt !== "string") {
      return c.json({ error: "invalid_expiresAt" }, 400)
    }
    const expiresAtDate = new Date(b.expiresAt)
    if (Number.isNaN(expiresAtDate.getTime())) {
      return c.json({ error: "invalid_expiresAt" }, 400)
    }
    if (expiresAtDate.getTime() <= Date.now()) {
      return c.json({ error: "expiresAt_in_past" }, 400)
    }
    expiresAt = expiresAtDate
  }

  let scopes: string[] | undefined
  if (b.scopes !== undefined) {
    if (
      !Array.isArray(b.scopes) ||
      b.scopes.some((s) => typeof s !== "string")
    ) {
      return c.json({ error: "invalid_scopes" }, 400)
    }
    const requested = Array.from(new Set(b.scopes as string[]))
    if (requested.length === 0) {
      return c.json({ error: "empty_scopes" }, 400)
    }
    if (requested.some((s) => !KNOWN_SCOPES.has(s))) {
      return c.json({ error: "unknown_scope" }, 400)
    }
    const roles = getUserRoles(user as { id: string } & Record<string, unknown>)
    const canUsePrivileged = roles.isAdmin || roles.isModerator
    if (!canUsePrivileged && requested.some((s) => PRIVILEGED_SCOPES.has(s))) {
      return c.json({ error: "forbidden_scope" }, 403)
    }
    scopes = requested
  }

  try {
    const created = await createApiKey(user.id, { name, expiresAt, scopes })
    return c.json(
      { token: created.token, apiKey: serializeApiKey(created.apiKey) },
      201,
    )
  } catch (err) {
    if (err instanceof ApiKeyLimitExceededError) {
      return c.json({ error: "limit_exceeded", message: err.message }, 400)
    }
    throw err
  }
})

me.delete("/api-keys/:id", async (c) => {
  const user = await requireSession(c)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const ok = await revokeApiKey(user.id, c.req.param("id"))
  if (!ok) return c.json({ error: "not_found" }, 404)
  return c.body(null, 204)
})
