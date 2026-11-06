/** DE PublicExport record shapes. fs-free, so data/curated can import them
 *  without pulling in the reader (read-de.ts). Unknown fields are preserved
 *  (`[key: string]: unknown`) so the merge step can pluck what it needs. */

export interface DeWeapon {
  uniqueName: string
  name: string
  description?: string
  codexSecret?: boolean
  productCategory: string
  damagePerShot?: number[]
  totalDamage?: number
  criticalChance?: number
  criticalMultiplier?: number
  procChance?: number
  fireRate?: number
  masteryReq?: number
  slot?: number
  accuracy?: number
  omegaAttenuation?: number
  maxLevelCap?: number
  noise?: string
  trigger?: string
  magazineSize?: number
  reloadTime?: number
  multishot?: number
  // Melee-specific
  blockingAngle?: number
  comboDuration?: number
  slamAttack?: number
  // Plus arbitrary extras
  [key: string]: unknown
}

export interface DeUpgrade {
  uniqueName: string
  name: string
  polarity?: string
  rarity?: string
  baseDrain?: number
  fusionLimit?: number
  compatName?: string
  type?: string
  levelStats?: Array<{ stats: string[] }>
  // DE ships description as string[] (one entry per paragraph). The merger
  // joins it into a single string.
  description?: string | string[]
  [key: string]: unknown
}

export interface DeUpgradesBlob {
  ExportUpgrades: DeUpgrade[]
  ExportModSet?: DeUpgrade[]
  ExportAvionics?: DeUpgrade[]
  ExportFocusUpgrades?: DeUpgrade[]
}

export interface DeFrame {
  uniqueName: string
  /** DE name. Archwing frames carry a `"<ARCHWING> "` prefix that needs
   *  stripping before matching against wiki keys. */
  name: string
  parentName?: string
  description?: string
  health: number
  shield: number
  armor: number
  stamina?: number
  power: number
  masteryReq?: number
  sprintSpeed?: number
  passiveDescription?: string
  exalted?: string[]
  /** DE uses `abilityUniqueName` / `abilityName` field names here; we
   *  rename to the more conventional `uniqueName`/`name` in merge-frames. */
  abilities?: Array<{
    abilityUniqueName: string
    abilityName: string
    description: string
    imageName?: string
  }>
  /** "Suits" | "SpaceSuits" | "MechSuits" — flat array in one blob. */
  productCategory: string
  codexSecret?: boolean
  [key: string]: unknown
}

export interface DeHelminthAbility {
  abilityUniqueName: string
  abilityName: string
  description: string
  imageName?: string
}

export interface DeSentinel {
  uniqueName: string
  name: string
  description?: string
  health?: number
  shield?: number
  armor?: number
  power?: number
  stamina?: number
  masteryReq?: number
  /** "Sentinels" | "KubrowPets" | "SpecialItems" */
  productCategory: string
  abilities?: unknown[]
  [key: string]: unknown
}

export interface DeManifestEntry {
  uniqueName: string
  textureLocation: string
}
