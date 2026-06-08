// Shared helpers for the DB-backed per-minute rate limiter (cookie-session
// middleware): window-start bucketing and the opportunistic prune policy.

/** Fraction of requests that opportunistically prune expired windows. */
export const PRUNE_PROBABILITY = 0.01

/** Windows older than this are eligible for pruning. */
export const PRUNE_MAX_AGE_MS = 10 * 60_000

/** Start of the current 1-minute window, used as the upsert key. */
export function currentWindowStart(now = Date.now()): Date {
  return new Date(Math.floor(now / 60_000) * 60_000)
}

/** Seconds until the current window rolls over (for Retry-After / Reset). */
export function secondsUntilNextMinute(now = Date.now()): number {
  return Math.max(1, 60 - Math.floor((now / 1000) % 60))
}
