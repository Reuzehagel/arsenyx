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
  /** Twin-frames (e.g. Sirius & Orion): which switchable form this variant
   *  builds. Indexes into the catalog item's `forms` array (0 = primary).
   *  Absent / 0 for every normal frame. */
  formIndex?: number
}

/**
 * Top-level build document. Holds shared metadata + 1..MAX_VARIANTS
 * variants. Legacy single-loadout (v1) builds are wrapped as a one-entry
 * variants array by `decodeBuildDoc` (build-codec.ts); the web adapter
 * `savedDataToBuildState` (apps/web/src/lib/codec/build-codec-adapter.ts)
 * bridges saved DB builds into a `BuildState`.
 */
export interface BuildDoc {
  itemUniqueName: string
  itemName: string
  itemCategory: BrowseCategory
  itemImageName?: string
  hasReactor: boolean
  /** The primary form's (form 0) Archon Shards — and the only shard set for
   *  every normal frame. Kept as the canonical field so existing builds and
   *  share links (which only ever had one shard set) read as the primary
   *  form's shards with no migration. */
  shardSlots: (PlacedShard | null)[]
  /** Twin-frames (Sirius & Orion): each form ("half") owns its own shards.
   *  Keyed by form index for forms ≥ 1; form 0 lives in `shardSlots` above.
   *  Absent for normal frames. */
  formShardSlots?: Record<number, (PlacedShard | null)[]>
  helminthAbility?: BuildState["helminthAbility"]
  zawComponents?: BuildState["zawComponents"]
  kitgunComponents?: BuildState["kitgunComponents"]
  lichBonusElement?: LichBonusElement
  buildName?: string

  variants: BuildVariant[]

  /** Variant the share link was generated on (v2 `ai`). Absent / 0 = first
   *  variant. Surfaced by `decodeBuildDoc`; the editor clamps it against the
   *  actual variant count via `clampVariantIndex`. */
  activeIndex?: number
}

/**
 * Resolve the Archon Shard set for a form. Form 0 (and every normal frame)
 * reads the canonical `shardSlots`; twin-frame forms ≥ 1 read their own slice
 * of `formShardSlots`, defaulting to empty so each "half" is independent.
 */
export function shardsForForm(
  doc: Pick<BuildDoc, "shardSlots" | "formShardSlots">,
  formIndex: number,
): (PlacedShard | null)[] {
  if (formIndex === 0) return doc.shardSlots
  return doc.formShardSlots?.[formIndex] ?? []
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
    // A variant's shards follow its form ("half"): twin-frames give each form
    // its own set; normal frames always resolve to `shardSlots`.
    shardSlots: shardsForForm(doc, v?.formIndex ?? 0),
    helminthAbility: doc.helminthAbility,
    zawComponents: doc.zawComponents,
    kitgunComponents: doc.kitgunComponents,
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

/** Generous upper bound applied when parsing a `?v=` index from the URL,
 *  before the doc is loaded. The viewer/editor then clamps to the actual
 *  variant count via `clampVariantIndex`. */
export const MAX_VARIANT_PARSE_INDEX = 50

export function clampVariantIndex(doc: BuildDoc, index: number): number {
  if (!Number.isFinite(index)) return 0
  const n = Math.floor(index)
  if (n < 0) return 0
  const max = doc.variants.length - 1
  return n > max ? max : n
}
