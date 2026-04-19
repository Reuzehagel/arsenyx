import { Hono } from "hono"

import { auth } from "../auth"
import { prisma } from "../db"
import {
  type ApiKeyListItem,
  ApiKeyLimitExceededError,
  createApiKey,
  listApiKeysForUser,
  revokeApiKey,
} from "../lib/api-keys"

export const me = new Hono()

const MAX_API_KEY_NAME = 100

async function requireSession(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers })
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
  const user = await requireSession(c.req.raw)
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
  const user = await requireSession(c.req.raw)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const keys = await listApiKeysForUser(user.id)
  return c.json({ apiKeys: keys.map(serializeApiKey) })
})

me.post("/api-keys", async (c) => {
  const user = await requireSession(c.req.raw)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "invalid_json" }, 400)
  }
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid_body" }, 400)
  }
  const b = body as Record<string, unknown>

  const rawName = typeof b.name === "string" ? b.name.trim() : ""
  if (!rawName) return c.json({ error: "invalid_name" }, 400)
  const name = rawName.slice(0, MAX_API_KEY_NAME)

  let expiresAt: Date | null = null
  if (b.expiresAt != null) {
    if (typeof b.expiresAt !== "string") {
      return c.json({ error: "invalid_expiresAt" }, 400)
    }
    const parsed = new Date(b.expiresAt)
    if (Number.isNaN(parsed.getTime())) {
      return c.json({ error: "invalid_expiresAt" }, 400)
    }
    if (parsed.getTime() <= Date.now()) {
      return c.json({ error: "expiresAt_in_past" }, 400)
    }
    expiresAt = parsed
  }

  try {
    const created = await createApiKey(user.id, { name, expiresAt })
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
  const user = await requireSession(c.req.raw)
  if (!user) return c.json({ error: "unauthorized" }, 401)

  const ok = await revokeApiKey(user.id, c.req.param("id"))
  if (!ok) return c.json({ error: "not_found" }, 404)
  return c.body(null, 204)
})
