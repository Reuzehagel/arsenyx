import { clamp } from "@arsenyx/shared"
import { MAX_VARIANT_PARSE_INDEX } from "@arsenyx/shared/warframe/build-doc"

/**
 * Clamp the embed display params (scale / bg / v) to their valid ranges.
 *
 * Shared by the SPA route's `validateSearch` (routes/builds.$slug.tsx) and the
 * router-less embed entry's `parseParams` (embed-main.tsx) so the bounds live in
 * exactly one place instead of drifting between the two. Each caller coerces its
 * own raw input first — the router hands `validateSearch` `unknown`, while the
 * embed reads `string | null` off `URLSearchParams` — then passes the coerced
 * values here for the shared bounds logic.
 *
 * `v` is 0-indexed and clamped to a generous upper bound only; the viewer
 * further clamps it to the actual variant count.
 */
export function clampEmbedParams(raw: {
  scale: number | undefined
  bg: string | undefined
  v: number | undefined
}): { scale?: number; bg?: string; v?: number } {
  const scale = raw.scale !== undefined ? clamp(raw.scale, 0.1, 2) : undefined
  const bg = raw.bg && raw.bg.length > 0 ? raw.bg : undefined
  const v =
    raw.v !== undefined && raw.v >= 0
      ? Math.min(MAX_VARIANT_PARSE_INDEX, Math.floor(raw.v))
      : undefined
  return { scale, bg, v }
}
