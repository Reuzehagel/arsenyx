/**
 * Minimal client-side warframe helpers. The heavy data loading lives at
 * build time in legacy/scripts/build-items-index.ts — the frontend only
 * needs enough to render cards and link to detail pages.
 */

const WFCD_CDN_BASE = "https://cdn.warframestat.us/img"

const PLACEHOLDER_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%23374151' width='128' height='128' rx='8'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='48' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"

export function getImageUrl(imageName?: string): string {
  if (!imageName) return PLACEHOLDER_URL
  return `${WFCD_CDN_BASE}/${imageName}`
}

export function getItemUrl(category: string, slug: string): string {
  return `/browse/${category}/${slug}`
}

/** Trim trailing zeros; integers render without a decimal point. */
export function formatStat(v: number, digits = 2): string {
  return Number.isInteger(v)
    ? v.toString()
    : parseFloat(v.toFixed(digits)).toString()
}

/** `0.155` → `"15.5%"`. `undefined` passes through. */
export function formatPct(
  v: number | undefined,
  digits = 1,
): string | undefined {
  if (v === undefined) return undefined
  return `${(v * 100).toFixed(digits)}%`
}

export type BrowseCategory =
  | "warframes"
  | "primary"
  | "secondary"
  | "melee"
  | "necramechs"
  | "companions"
  | "companion-weapons"
  | "exalted-weapons"
  | "archwing"

export interface BrowseItem {
  uniqueName: string
  name: string
  slug: string
  category: BrowseCategory
  imageName?: string
  masteryReq?: number
  isPrime?: boolean
  vaulted?: boolean
  type?: string
  releaseDate?: string
}

export type ItemsIndex = Partial<Record<BrowseCategory, BrowseItem[]>>

export interface ItemAbility {
  uniqueName: string
  name: string
  description: string
  imageName?: string
}

export interface DetailItem extends BrowseItem {
  description?: string
  // slot polarities (from WFCD): `aura` is warframe-only, `polarities` lists
  // innate polarities on normal slots in slot order, `exilusPolarity` is the
  // innate polarity on the exilus slot (weapons + warframes).
  aura?: string | string[]
  polarities?: string[]
  exilusPolarity?: string
  // warframe
  health?: number
  shield?: number
  armor?: number
  power?: number
  sprintSpeed?: number
  abilities?: ItemAbility[]
  // weapon
  maxLevelCap?: number
  totalDamage?: number
  criticalChance?: number
  criticalMultiplier?: number
  procChance?: number
  fireRate?: number
  magazineSize?: number
  reloadTime?: number
  range?: number
}

export const CATEGORIES: { id: BrowseCategory; label: string }[] = [
  { id: "warframes", label: "Warframes" },
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "melee", label: "Melee" },
  { id: "companions", label: "Companions" },
  { id: "companion-weapons", label: "Companion Weapons" },
  { id: "archwing", label: "Archwing" },
  { id: "necramechs", label: "Necramechs" },
  { id: "exalted-weapons", label: "Exalted" },
]

export function isValidCategory(value: string): value is BrowseCategory {
  return CATEGORIES.some((c) => c.id === value)
}
