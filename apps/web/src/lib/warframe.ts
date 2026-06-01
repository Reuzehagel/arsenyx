/**
 * Minimal client-side warframe helpers. The heavy data loading lives at
 * build time in scripts/build-items-index.ts — the frontend only
 * needs enough to render cards and link to detail pages.
 */

import type { BrowseCategory, BrowseItem } from "@arsenyx/shared/warframe/types"
export type { BrowseCategory, BrowseItem } from "@arsenyx/shared/warframe/types"

const PLACEHOLDER_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%23374151' width='128' height='128' rx='8'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='48' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"

/** Hosts the build pipeline is allowed to emit absolute URLs against.
 *  Production catalog points at `img.arsenyx.com` (our R2 bucket, see
 *  `scripts/sync-images.ts`). The two upstream hosts are also accepted
 *  so a dev workflow that ran `build:items` without `sync:images` still
 *  renders correctly. Anything else falls through to the placeholder,
 *  so an attacker-controlled value can't reach `<img src>`. */
const TRUSTED_IMAGE_PREFIXES = [
  "https://img.arsenyx.com/",
  "https://content.warframe.com/PublicExport/",
  "https://wiki.warframe.com/images/",
] as const

export function getImageUrl(imageName?: string): string {
  if (!imageName) return PLACEHOLDER_URL
  // Locally-hosted icons live under `/img/`.
  if (imageName.startsWith("/img/")) return imageName
  for (const prefix of TRUSTED_IMAGE_PREFIXES) {
    if (imageName.startsWith(prefix)) return imageName
  }
  return PLACEHOLDER_URL
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

export type ItemsIndex = Partial<Record<BrowseCategory, BrowseItem[]>>

export interface ItemAbility {
  uniqueName: string
  name: string
  description: string
  imageName?: string
}

export interface DetailItem extends BrowseItem {
  description?: string
  // slot polarities. `auraPolarity` is warframe-only (array on multi-aura
  // frames like Jade), `polarities` lists innate polarities on normal slots
  // in slot order, `exilusPolarity` is the innate polarity on the exilus
  // slot (weapons + warframes).
  auraPolarity?: string | string[] | null
  polarities?: string[]
  exilusPolarity?: string | null
  stancePolarity?: string
  /** Exalted melee weapons (except Garuda Talons) carry a permanently
   *  installed stance the player can't change. When present, the editor
   *  renders a locked, pre-filled stance slot worth +10 capacity. The stance's
   *  polarity matches `stancePolarity` (Zenurik). Absent on weapons with a
   *  free/normal stance slot. */
  innateStance?: { name: string; imageName?: string }
  meleeClass?: string
  // warframe
  health?: number
  shield?: number
  armor?: number
  power?: number
  sprintSpeed?: number
  abilities?: ItemAbility[]
  // weapon
  maxLevelCap?: number
  /** Modular chamber/strike family ("Sporelacer", "Catchmoon") — used to key
   *  into the kitgun stat tables in /data/modular.json. */
  family?: string
  trigger?: string
  totalDamage?: number
  criticalChance?: number
  criticalMultiplier?: number
  procChance?: number
  fireRate?: number
  magazineSize?: number
  reloadTime?: number
  range?: number
  // Arch-gun atmospheric damage variant — only present when it differs from
  // the default Archwing-mission profile (currently Corvas / Corvas Prime).
  atmosphericDamage?: Record<string, number | undefined>
  atmosphericTotalDamage?: number
  atmosphericAttacks?: Array<{
    name: string
    speed?: number
    crit_chance?: number
    crit_mult?: number
    status_chance?: number
    damage?: Record<string, number | undefined> | string
  }>
  // Beast claws (hardcoded synthetic entries): lowercased compatNames the
  // weapon accepts. Used by getModsForItem to pick claws/family/pet mods.
  compatGroups?: string[]
  /** Structural mod routing: DE `compatName` values this item accepts.
   *  Emitted by the build on every weapon/frame/companion and consumed by
   *  `getModsForItem`. */
  modPools?: readonly string[]
  /** Weapon intrinsic tags from OpenWF (`GRNBOW`, `SEMI_AUTO`, `PROJECTILE`,
   *  …). Refined against mod `compatTags`/`incompatTags` in `getModsForItem`.
   *  Weapons-only; absent on frames/companions (→ no tag restriction). */
  compatTags?: readonly string[]
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
  // Railjack tab only surfaces the Plexus (the mod-equip entry point).
  // Turrets, ordnance, and reactors are sidebar pickers inside the Plexus
  // editor — they live in the catalog but are not browseable items.
  { id: "railjack", label: "Railjack" },
]

export function isValidCategory(value: string): value is BrowseCategory {
  return CATEGORIES.some((c) => c.id === value)
}

export function getCategoryLabel(category: string): string {
  return CATEGORIES.find((c) => c.id === category)?.label ?? category
}
