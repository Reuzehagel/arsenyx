import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"

export type SetVariants = (
  next: SavedVariant[] | ((prev: SavedVariant[]) => SavedVariant[]),
) => void

export const MAX_VARIANT_LABEL = 24

/** `variants` with the active one replaced by its live snapshot. */
export function foldedVariants(
  variants: SavedVariant[],
  activeIndex: number,
  activeSnapshot: SavedVariant,
): SavedVariant[] {
  return variants.map((v, i) => (i === activeIndex ? activeSnapshot : v))
}

/** Tab label: the user's label, or "Variant N" (1-based) when blank. */
export function variantDisplayLabel(
  v: { label: string },
  index: number,
): string {
  return v.label || `Variant ${index + 1}`
}

/** A typed variant name, trimmed and capped; blank falls back to the tab's
 *  default label. */
export function normalizeVariantLabel(raw: string, index: number): string {
  return raw.trim().slice(0, MAX_VARIANT_LABEL) || `Variant ${index + 1}`
}
