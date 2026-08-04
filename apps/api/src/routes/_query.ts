// Shared query-string parsers for paginated list routes.

// Hard ceiling on `?page`. Pagination is OFFSET-based (`skip = (page-1) * limit`
// in _build-list.ts), so an unbounded page number lets an anonymous caller ask
// Postgres to walk and discard millions of rows per request — the cheapest way
// to burn PlanetScale compute through a public endpoint. At the 24-row
// LIST_LIMIT this still exposes 12k rows deep, far past any real result set
// (and past what crawlers walk), so it costs nothing legitimate.
const MAX_PAGE = 500

export function parsePage(v: string | undefined): number {
  const n = parseInt(v ?? "1", 10)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(n, MAX_PAGE)
}

export function trimQ(v: string | undefined, max = 100): string | undefined {
  const t = v?.trim()
  return t && t.length > 0 ? t.slice(0, max) : undefined
}

const TRUE_VALUES = new Set(["1", "true", "yes", "on", ""])
const FALSE_VALUES = new Set(["0", "false", "no", "off"])

// Tri-state boolean for optional filter params: `true`, `false`, or `undefined`
// meaning "don't filter on this at all".
//
// The three states matter. A two-state parser (present-and-truthy vs anything
// else) can't express "only rows where this is false" — `?hasGuide=false`
// collapses into the same thing as omitting the param, which is what issue #319
// reported. Callers must branch on `!== undefined`, not on truthiness.
//
// A bare key (`?hasGuide`, which Hono surfaces as "") reads as true: that's the
// convention for HTML-ish flag params, and it's what a human typing a URL
// expects. Unrecognized values are `undefined` (ignored) rather than an error,
// matching how `sort` and `category` already treat junk input on these routes.
export function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined
  const s = v.trim().toLowerCase()
  if (TRUE_VALUES.has(s)) return true
  if (FALSE_VALUES.has(s)) return false
  return undefined
}
