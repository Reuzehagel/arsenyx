import type { MiddlewareHandler } from "hono"

import { prisma, registerBackgroundWork } from "../db"
import { getSession } from "../lib/session"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const PRUNE_PROBABILITY = 0.01
const PRUNE_MAX_AGE_MS = 10 * 60_000

// Per-bucket per-minute caps for cookie-session mutations. Tuned generously —
// the goal is abuse throttling, not policing normal use.
//
// "social" covers cheap toggles (likes, bookmarks, view-count).
// "mutate" covers the heavier writes (build create/update/delete, org admin).
// "import" covers external-fetch mutations (Overframe scrape).
export const RATE_LIMITS = {
  social: 60,
  mutate: 20,
  import: 10,
} as const

export type RateLimitBucket = keyof typeof RATE_LIMITS

function currentWindowStart(now = Date.now()): Date {
  return new Date(Math.floor(now / 60_000) * 60_000)
}

function secondsUntilNextMinute(now = Date.now()): number {
  return Math.max(1, 60 - Math.floor((now / 1000) % 60))
}

// Best-effort rate limiter for session-cookie routes. Same semantics as the
// PAT limiter in api-key-auth.ts: the upsert is racy across Workers isolates
// so short bursts can exceed the cap before any isolate observes it. Fine for
// abuse throttling.
export function rateLimitUser(bucket: RateLimitBucket): MiddlewareHandler {
  const limit = RATE_LIMITS[bucket]
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next()

    const session = await getSession(c)
    if (!session?.user) return next() // Let downstream handler return 401.
    const userId = session.user.id

    const windowStart = currentWindowStart()
    const window = await prisma.userRateLimitWindow.upsert({
      where: {
        userId_bucket_windowStart: { userId, bucket, windowStart },
      },
      create: { userId, bucket, windowStart, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
      select: { requestCount: true },
    })

    const used = window.requestCount
    const resetSeconds = secondsUntilNextMinute()

    c.header("X-RateLimit-Limit", String(limit))
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - used)))
    c.header("X-RateLimit-Reset", String(resetSeconds))

    if (used > limit) {
      c.header("Retry-After", String(resetSeconds))
      return c.json({ error: "rate_limited" }, 429)
    }

    if (Math.random() < PRUNE_PROBABILITY) {
      registerBackgroundWork(
        prisma.userRateLimitWindow.deleteMany({
          where: {
            windowStart: { lt: new Date(Date.now() - PRUNE_MAX_AGE_MS) },
          },
        }),
      )
    }

    await next()
  }
}
