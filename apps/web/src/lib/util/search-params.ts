// Coercion for router search values, which arrive as `unknown`: a number or
// boolean once the router has JSON-parsed them, a string from a hand-typed URL.

import { SEARCH_Q_MAX } from "@arsenyx/shared/api/limits"
import { MAX_VARIANT_PARSE_INDEX } from "@arsenyx/shared/warframe/build-doc"

/** An integer (fractions truncated), or undefined. */
export function searchInt(v: unknown): number | undefined {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

/** A 1-based page; page 1 is undefined so the bare URL stays canonical. */
export function searchPage(v: unknown): number | undefined {
  const n = searchInt(v)
  return n !== undefined && n > 1 ? n : undefined
}

/** Free-text query capped at the API's `trimQ` limit for that endpoint, so the
 *  URL holds what the server searched on. Neither trimmed nor emptied when
 *  blank: a live input echoes this value back, and either would eat the space
 *  just typed. */
export function searchText(
  v: unknown,
  max: number = SEARCH_Q_MAX,
): string | undefined {
  return typeof v === "string" && v ? v.slice(0, max) : undefined
}

/** `true` / `"true"` → true, else undefined (absent from the URL). */
export function searchFlag(v: unknown): true | undefined {
  return v === true || v === "true" ? true : undefined
}

/** One of `values`, else undefined. */
export function searchEnum<T extends string>(
  v: unknown,
  values: readonly T[],
): T | undefined {
  return (values as readonly unknown[]).includes(v) ? (v as T) : undefined
}

/** `?v=` variant index: non-negative, capped generously (the viewer clamps it
 *  to the build's real variant count). */
export function parseVariantIndex(v: unknown): number | undefined {
  const n = searchInt(v)
  return n !== undefined && n >= 0
    ? Math.min(MAX_VARIANT_PARSE_INDEX, n)
    : undefined
}
