import type { PartnerBuild } from "@arsenyx/shared/api/build-dto"
import { MAX_TOTAL_VARIANTS } from "@arsenyx/shared/warframe/build-data"

import type { Prisma } from "../generated/prisma/client"
import { LIST_SELECT, serializeListRow, type ListRow } from "./_build-list"
import { visiblePartnerScope } from "./_build-visibility"

// A build's partner strip ("Related builds"): which partners a viewer sees,
// in the owner's order, each carrying the owner's chosen variant.

/** Whether `v` can name a variant of a stored build. 0 is the default
 *  variant; the bound is the whole document's variant cap, not the per-form
 *  one — a twin-frame's second form starts at index MAX_VARIANTS. */
export function isVariantIndex(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= 0 &&
    v < MAX_TOTAL_VARIANTS
  )
}

/** Coerce the `partnerVariants` JSON column into a clean id -> variant-index
 *  map. Anything that isn't a positive variant index is dropped (0 / absent
 *  both mean "default variant", so 0 is never stored), which also makes this
 *  the point where stale garbage in the column goes away on rewrite. */
export function asVariantMap(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [id, v] of Object.entries(value)) {
    if (isVariantIndex(v) && v > 0) out[id] = v
  }
  return out
}

/** Select for a build's partner strip. Callers pass
 *  `relationLoadStrategy: "join"`: partnerBuilds nests user + organization
 *  (via LIST_SELECT), and the join collapses that fan-out into one query. */
export function partnerSelect(viewerId: string | undefined) {
  return {
    partnerOrder: true,
    partnerVariants: true,
    partnerBuilds: {
      where: visiblePartnerScope(viewerId),
      take: 50,
      select: LIST_SELECT,
    },
  } as const
}

type PartnerStripRow = {
  partnerOrder: string[]
  partnerVariants: Prisma.JsonValue
  partnerBuilds: ListRow[]
}

/** The strip in the owner's order. The saved variant target rides along on
 *  each row (`variant` omitted = default); the web chip turns it into `?v=`,
 *  and an index that outgrew the partner's variant list is clamped by the
 *  viewer. */
export function serializePartners(build: PartnerStripRow): PartnerBuild[] {
  const variantMap = asVariantMap(build.partnerVariants)
  return orderPartners(build.partnerBuilds, build.partnerOrder).map((p) => {
    const row = serializeListRow(p)
    const variant = variantMap[p.id]
    return variant ? { ...row, variant } : row
  })
}

// Ids listed in `order` come first in that order; anything not listed (newly
// linked, or never reordered) keeps its original relative position at the end
// (Array.sort is stable). Stale ids that no longer resolve are skipped.
function orderPartners<T extends { id: string }>(
  rows: T[],
  order: string[],
): T[] {
  if (order.length === 0) return rows
  const rank = new Map(order.map((id, i) => [id, i]))
  const fallback = order.length
  return rows
    .slice()
    .sort((a, b) => (rank.get(a.id) ?? fallback) - (rank.get(b.id) ?? fallback))
}
