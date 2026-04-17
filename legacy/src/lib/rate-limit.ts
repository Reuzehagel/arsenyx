/**
 * Rate Limiting Utility
 *
 * In-memory rate limiting using LRU cache.
 * For production scale, consider upgrading to Upstash Redis.
 */

import { LRUCache } from "lru-cache"

interface RateLimitOptions {
  /** Max unique tokens to track (default: 500) */
  uniqueTokenPerInterval?: number
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  interval?: number
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends Error {
  constructor(message = "Rate limit exceeded") {
    super(message)
    this.name = "RateLimitError"
  }
}

/**
 * Create a rate limiter instance
 */
export function rateLimit(options?: RateLimitOptions) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options?.uniqueTokenPerInterval ?? 500,
    ttl: options?.interval ?? 60000,
  })

  return {
    /**
     * Check if an action is allowed within rate limits
     * @param limit - Max actions allowed in the time window
     * @param token - Unique identifier for the rate limit (e.g., user ID)
     * @throws {RateLimitError} If rate limit is exceeded
     */
    check: async (limit: number, token: string): Promise<void> => {
      const tokenCount = tokenCache.get(token) ?? [0]

      if (tokenCount[0] >= limit) {
        throw new RateLimitError()
      }

      tokenCount[0] += 1
      tokenCache.set(token, tokenCount)
    },
  }
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

/**
 * Vote rate limiter: 10 votes per minute per user
 */
export const voteLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

/**
 * Favorite rate limiter: 20 favorites per minute per user
 */
export const favoriteLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

/**
 * Search rate limiter: 30 searches per minute per IP
 */
export const searchLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
})

/**
 * Image generation rate limiter: 10 images per minute per IP
 */
export const imageLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
})

/**
 * Profile update rate limiter: 10 updates per minute per user
 */
export const profileLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
})

/**
 * Screenshot referer rate limiter: per-origin, hourly window
 * Used only for referer-based (allowlisted) screenshot access.
 * API key access uses DB-backed rate limiting instead.
 */
export const screenshotLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 100,
})
