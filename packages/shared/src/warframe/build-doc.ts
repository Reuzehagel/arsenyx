import type {
  BrowseCategory,
  BuildState,
  DeploymentContext,
  LichBonusElement,
  ModSlot,
  PlacedArcane,
  PlacedShard,
} from "./types"

export const MAX_VARIANTS = 5

/**
 * Per-variant slice of a build. Mods/arcanes/incarnon perks/deployment
 * context vary between variants; everything else (item, shards, forma,
 * reactor, helminth, lich element, guide, name) is shared across all
 * variants of one build.
 *
 * `formaPolarity` still lives on individual `ModSlot`s for backward
 * compatibility with `BuildState`; the editor must keep formaPolarity
 * synchronized across variants for the same slot id.
 */
export interface BuildVariant {
  id: string
  label: string
  auraSlots: ModSlot[]
  exilusSlot?: ModSlot
  stanceSlot?: ModSlot
  normalSlots: ModSlot[]
  arcaneSlots: (PlacedArcane | null)[]
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  deploymentContext?: DeploymentContext
  guideSummary?: string
  guideDescription?: string
}

/**
 * Top-level build document. Holds shared metadata + 1..MAX_VARIANTS
 * variants. Legacy single-loadout builds are wrapped as a one-entry
 * variants array via `normalizeToBuildDoc` (web adapter).
 */
export interface BuildDoc {
  itemUniqueName: string
  itemName: string
  itemCategory: BrowseCategory
  itemImageName?: string
  hasReactor: boolean
  shardSlots: (PlacedShard | null)[]
  helminthAbility?: BuildState["helminthAbility"]
  zawComponents?: BuildState["zawComponents"]
  lichBonusElement?: LichBonusElement
  buildName?: string

  variants: BuildVariant[]

  /** Variant the share link was generated on (v2 `ai`). Absent / 0 = first
   *  variant. Surfaced by `decodeBuildDoc`; the editor clamps it against the
   *  actual variant count via `clampVariantIndex`. */
  activeIndex?: number
}

/**
 * Project a (doc, index) pair back into a `BuildState` that the existing
 * stat engine, capacity calc, and mod search already understand. Capacity
 * fields are zeroed because every consumer recomputes them downstream.
 */
export function projectVariant(doc: BuildDoc, index: number): BuildState {
  const v = doc.variants[index] ?? doc.variants[0]
  return {
    itemUniqueName: doc.itemUniqueName,
    itemName: doc.itemName,
    itemCategory: doc.itemCategory,
    itemImageName: doc.itemImageName,
    hasReactor: doc.hasReactor,
    shardSlots: doc.shardSlots,
    helminthAbility: doc.helminthAbility,
    zawComponents: doc.zawComponents,
    lichBonusElement: doc.lichBonusElement,
    buildName: doc.buildName,
    auraSlots: v.auraSlots,
    exilusSlot: v.exilusSlot,
    stanceSlot: v.stanceSlot,
    normalSlots: v.normalSlots,
    arcaneSlots: v.arcaneSlots,
    incarnonEnabled: v.incarnonEnabled,
    incarnonPerks: v.incarnonPerks,
    deploymentContext: v.deploymentContext,
    baseCapacity: 0,
    currentCapacity: 0,
    formaCount: 0,
  }
}

export function clampVariantIndex(doc: BuildDoc, index: number): number {
  if (!Number.isFinite(index)) return 0
  const n = Math.floor(index)
  if (n < 0) return 0
  const max = doc.variants.length - 1
  return n > max ? max : n
}
