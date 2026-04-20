import type { MiddlewareHandler } from "hono"

import { prisma, registerBackgroundWork } from "../db"
import { type ApiKeyScope, hashApiKey } from "./api-keys"

const PRUNE_PROBABILITY = 0.01
const PRUNE_MAX_AGE_MS = 10 * 60_000

function currentWindowStart(now = Date.now()): Date {
  return new Date(Math.floor(now / 60_000) * 60_000)
}

function secondsUntilNextMinute(now = Date.now()): number {
  return Math.max(1, 60 - Math.floor((now / 1000) % 60))
}

export function requireApiKey(requiredScope: ApiKeyScope): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("authorization")
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      return c.json({ error: "unauthorized" }, 401)
    }
    const token = header.slice(7).trim()
    if (!token) return c.json({ error: "unauthorized" }, 401)

    const apiKey = await prisma.apiKey.findUnique({
      where: { key: hashApiKey(token) },
      select: {
        id: true,
        userId: true,
        scopes: true,
        rateLimit: true,
        isActive: true,
        expiresAt: true,
      },
    })

    if (!apiKey || !apiKey.isActive) {
      return c.json({ error: "invalid_key" }, 401)
    }
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
      return c.json({ error: "invalid_key" }, 401)
    }
    if (!apiKey.scopes.includes(requiredScope)) {
      return c.json(
        { error: "insufficient_scope", required: requiredScope },
        403,
      )
    }

    // Best-effort rate limit: the upsert+compare is racy across isolates, so
    // short bursts can exceed `limit` before any isolate observes it. Fine
    // for abuse throttling; do not rely on this for hard quotas or billing.
    const windowStart = currentWindowStart()
    const window = await prisma.apiKeyRateLimitWindow.upsert({
      where: { apiKeyId_windowStart: { apiKeyId: apiKey.id, windowStart } },
      create: { apiKeyId: apiKey.id, windowStart, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
      select: { requestCount: true },
    })

    const limit = apiKey.rateLimit
    const used = window.requestCount
    const resetSeconds = secondsUntilNextMinute()

    c.header("X-RateLimit-Limit", String(limit))
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - used)))
    c.header("X-RateLimit-Reset", String(resetSeconds))

    if (used > limit) {
      c.header("Retry-After", String(resetSeconds))
      return c.json({ error: "rate_limited" }, 429)
    }

    registerBackgroundWork(
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
        select: { id: true },
      }),
    )

    if (Math.random() < PRUNE_PROBABILITY) {
      registerBackgroundWork(
        prisma.apiKeyRateLimitWindow.deleteMany({
          where: {
            windowStart: { lt: new Date(Date.now() - PRUNE_MAX_AGE_MS) },
          },
        }),
      )
    }

    await next()
  }
}
