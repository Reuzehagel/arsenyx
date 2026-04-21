// Shared query-string parsers for paginated list routes.

export function parsePage(v: string | undefined): number {
  const n = parseInt(v ?? "1", 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function trimQ(v: string | undefined, max = 100): string | undefined {
  const t = v?.trim()
  return t && t.length > 0 ? t.slice(0, max) : undefined
}
