// Client-side shapes of the static catalog (`public/data/`, emitted by
// scripts/build-items-index.ts) beyond what @arsenyx/shared already types.

import { CATEGORY_LABELS } from "@arsenyx/shared/warframe/categories"
import type {
  Ability,
  BrowseCategory,
  BrowseItem,
  FrameForm,
} from "@arsenyx/shared/warframe/types"

export type ItemsIndex = Partial<Record<BrowseCategory, BrowseItem[]>>

/** One item's detail file: `items/<category>/<slug>.json`. */
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
  // warframe
  health?: number
  shield?: number
  armor?: number
  power?: number
  sprintSpeed?: number
  abilities?: Ability[]
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
  /** Twin-frames (Sirius & Orion) ship two switchable forms with distinct
   *  ability sets. `forms[0]` is the primary and mirrors the top-level
   *  `abilities`/`passiveDescription`/`exalted`; the build's per-variant
   *  `formIndex` selects which form a variant uses. */
  forms?: FrameForm[]
}

/**
 * Browse-tab position per category. Intentionally differs from the canonical
 * id order in `BROWSE_CATEGORY_IDS` (e.g. companions grouped before
 * necramechs). A `Record` so a new category fails to compile until it gets a
 * tab. Railjack's tab only surfaces the Plexus (the mod-equip entry point);
 * turrets, ordnance and reactors are sidebar pickers inside the Plexus editor.
 */
const BROWSE_TAB_ORDER: Record<BrowseCategory, number> = {
  warframes: 0,
  operators: 1,
  primary: 2,
  secondary: 3,
  melee: 4,
  companions: 5,
  "companion-weapons": 6,
  archwing: 7,
  necramechs: 8,
  "exalted-weapons": 9,
  railjack: 10,
}

/** Browse tabs in display order, labelled from the shared CATEGORY_LABELS. */
export const CATEGORIES: { id: BrowseCategory; label: string }[] = (
  Object.keys(BROWSE_TAB_ORDER) as BrowseCategory[]
)
  .sort((a, b) => BROWSE_TAB_ORDER[a] - BROWSE_TAB_ORDER[b])
  .map((id) => ({ id, label: CATEGORY_LABELS[id] }))
