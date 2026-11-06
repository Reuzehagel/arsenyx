/**
 * Marker log lines `bun run cf:usage` counts in Workers Logs (table 3 of
 * scripts/cf-usage.ts, which imports this). shortcut: measurement only; remove
 * them together with that query once the plain-SQL rewrite of the detail
 * paths is decided (docs/usage-analytics.md).
 */
export const DETAIL_MARKERS = {
  /** Anonymous detail request whose KV snapshot missed (Prisma rebuild). */
  kvMiss: "detail:kv-miss",
  /** Signed-in detail request served live through Prisma. */
  live: "detail:live",
} as const
