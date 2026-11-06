/**
 * The persisted build document: the shape stored in `Build.buildData` (a
 * Prisma JSON column). The web editor writes it, the API validates and diffs
 * it, scripts read it. Rows written by any past client version live in the
 * table, so readers on the API side still treat it as untrusted JSON.
 */
import { MAX_VARIANTS } from "./build-doc"
import type { Polarity } from "./polarities"
import type {
  AbilityStat,
  Arcane,
  DeploymentContext,
  LichBonusElement,
  Mod,
  PlacedShard,
} from "./types"

export type SlotId = `aura-${number}` | "exilus" | "stance" | `normal-${number}`

export const normalSlotId = (i: number): SlotId => `normal-${i}`
export const auraSlotId = (i: number): SlotId => `aura-${i}`

/** A suggested one-for-one swap for a Slot's mod (see GLOSSARY.md →
 *  Alternate mod). Display-only: capacity, drain, stats and forma never read
 *  it. */
export interface AlternateMod {
  mod: Mod
  rank: number
}

export interface PlacedMod {
  mod: Mod
  rank: number
  alternate?: AlternateMod
}

export interface PlacedArcane {
  arcane: Arcane
  rank: number
}

/** One entry of `helminth-abilities.json`, also stored per slot index in a
 *  build's `helminth` map. */
export interface HelminthAbility {
  uniqueName: string
  name: string
  imageName?: string
  description: string
  /** "Helminth" for Helminth-native abilities, or the source warframe name. */
  source: string
  stats?: AbilityStat[]
}

/** Snapshots of mods/arcanes referenced from guide text via `[Name](mod:…)`
 *  links (build-wide + per-variant), deduped by uniqueName. */
export type GuideRefs = {
  mods?: Mod[]
  arcanes?: Arcane[]
}

/**
 * Per-variant slice stored inside `SavedBuildData.variants`. When the
 * `variants` array is present (length >= 1), the per-variant fields here
 * supersede the legacy top-level `slots`/`arcanes`/`incarnon*`/
 * `deploymentContext` fields. Top-level fields stay populated for the
 * active variant so old clients that ignore `variants` still render the
 * default loadout — graceful degradation, not a hard cutover.
 */
export type SavedVariant = {
  id: string
  label: string
  slots: Partial<Record<SlotId, PlacedMod>>
  arcanes: (PlacedArcane | null)[]
  /** This variant's Archon Shards. Per-variant: each loadout installs its own
   *  set. Absent on builds saved before per-variant shards — load resolves it
   *  from the legacy top-level `shards`/`formShards` (copy-on-load), so an old
   *  build's single set shows on every variant until one is edited. */
  shards?: (PlacedShard | null)[]
  helminth?: Record<number, HelminthAbility>
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  deploymentContext?: DeploymentContext
  operatorAmp?: string
  focusSchool?: string
  /** Twin-frame (Sirius & Orion) form this variant builds — indexes the
   *  catalog item's `forms` array (0 = primary). Absent for normal frames. */
  formIndex?: number
  /** Optional per-variant guide. When absent, the viewer falls back to
   *  the build-wide guide from BuildDetail.guide. Stored inside
   *  `buildData.variants[i]` (JSON column) — no separate DB row. */
  guideSummary?: string
  guideDescription?: string
}

/** Shape stored in `Build.buildData` (Prisma JSON). */
export type SavedBuildData = {
  version?: number
  slots?: Partial<Record<SlotId, PlacedMod>>
  formaPolarities?: Partial<Record<SlotId, Polarity>>
  arcanes?: (PlacedArcane | null)[]
  /** Top-level mirror of the active variant's Archon Shards (per-variant; see
   *  `SavedVariant.shards`). Kept populated for legacy clients that ignore the
   *  `variants` array, and it's the sole shard set for synthetic single-variant
   *  builds. Pre-per-variant builds stored their only set here. */
  shards?: (PlacedShard | null)[]
  /** @deprecated Legacy twin-frame per-form shards (the short-lived per-form
   *  model), keyed by form index. Read-only for copy-on-load when a variant has
   *  no `shards` of its own; new saves write per-variant `SavedVariant.shards`
   *  instead and never emit this. */
  formShards?: Record<number, (PlacedShard | null)[]>
  hasReactor?: boolean
  helminth?: Record<number, HelminthAbility>
  zawComponents?: { grip: string; link: string }
  kitgunComponents?: { grip: string; loader: string }
  lichBonusElement?: LichBonusElement
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  deploymentContext?: DeploymentContext
  operatorAmp?: string
  focusSchool?: string
  /** Top-level mirror of the active variant's `formIndex` (per-variant data;
   *  see `PerVariantDataField`). */
  formIndex?: number

  // Multi-variant support (added 2026-05-23). When present, length >= 1
  // and the top-level mod/arcane fields mirror variants[0] for legacy
  // viewer compatibility.
  variants?: SavedVariant[]

  /** Snapshots of mods/arcanes referenced from guide text — see GuideRefs.
   *  Build-wide (covers the build guide and every per-variant guide),
   *  recomputed on each save. */
  guideRefs?: GuideRefs
}

/**
 * The per-variant *data* fields — the ones that differ between variants and are
 * mirrored on top-level `SavedBuildData` for legacy clients. Derived from
 * `SavedVariant` by excluding identity (`id`/`label`), the structural loadout
 * (`slots`/`arcanes`, always present with a default), and the separately-handled
 * per-variant guide. Deriving by exclusion makes the set self-maintaining: a new
 * `SavedVariant` field automatically becomes a per-variant data field, and
 * `pickPerVariantData` — the single point every converter threads these
 * through — then fails to compile until it's handled, so no converter can
 * silently drop it. (Adding a field that's genuinely *not* per-variant data
 * just means listing it in the exclusion below.)
 */
export type PerVariantDataField = Exclude<
  keyof SavedVariant,
  | "id"
  | "label"
  | "slots"
  | "arcanes"
  | "shards"
  | "guideSummary"
  | "guideDescription"
>

/**
 * The per-variant data slice, copied from any source that carries these fields
 * (top-level `SavedBuildData`, a `SavedVariant`, or live editor state). The
 * single choke point that every per-variant data emission routes through:
 * getVariants (synthesize from top-level), selectVariant (project a variant
 * back), and the editor's variant capture all call this, so they can't disagree
 * on what "per-variant" means or forget a field.
 *
 * Written as an explicit object (not a spread or a loop) typed to
 * `PerVariantDataField` on both sides — so adding a per-variant field to
 * `SavedVariant` makes this fail to compile until it's listed here, and requires
 * the matching top-level mirror on `SavedBuildData` (the param `Pick`). Fields
 * absent on the source stay `undefined`.
 */
export function pickPerVariantData(
  src: Pick<SavedBuildData, PerVariantDataField>,
): Pick<SavedVariant, PerVariantDataField> {
  return {
    helminth: src.helminth,
    incarnonEnabled: src.incarnonEnabled,
    incarnonPerks: src.incarnonPerks,
    deploymentContext: src.deploymentContext,
    operatorAmp: src.operatorAmp,
    focusSchool: src.focusSchool,
    formIndex: src.formIndex,
  }
}

// ---------------------------------------------------------------------------
// Checks over untrusted `buildData` (API request bodies, old DB rows). They
// take `unknown` and read the SavedBuildData keys defensively.
// ---------------------------------------------------------------------------

/** A persisted record whose keys are known but whose values are untrusted. */
export type Untrusted<T> = { [K in keyof T]?: unknown }

export function asRecord<T>(v: unknown): Untrusted<T> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Untrusted<T>)
    : null
}

/** Implausibly many twin-frame forms in one build. */
const MAX_FORMS = 4

/** Most variants a stored document may hold across all its forms — the bound
 *  for anything indexing into `variants` (e.g. a partner link's variant). */
export const MAX_TOTAL_VARIANTS = MAX_FORMS * MAX_VARIANTS

/** Defense in depth: the editor caps `variants` at MAX_VARIANTS *per form*
 *  (twin-frames like Sirius & Orion give each form its own budget), but a
 *  crafted request could send more. True when any single form exceeds the
 *  cap, or there are implausibly many forms. */
export function variantsOverCap(buildData: unknown): boolean {
  const variants = asRecord<SavedBuildData>(buildData)?.variants
  if (!Array.isArray(variants)) return false
  const perForm = new Map<number, number>()
  for (const v of variants) {
    const fi = asRecord<SavedVariant>(v)?.formIndex
    const key = typeof fi === "number" ? fi : 0
    perForm.set(key, (perForm.get(key) ?? 0) + 1)
  }
  if (perForm.size > MAX_FORMS) return true
  for (const count of perForm.values()) if (count > MAX_VARIANTS) return true
  return false
}

/** Whether any Archon Shard is placed anywhere in the document: the
 *  top-level mirror, any variant, or the legacy per-form sets. */
export function hasShardsInBuildData(buildData: unknown): boolean {
  const data = asRecord<SavedBuildData>(buildData)
  if (!data) return false
  const anyPlaced = (v: unknown): boolean =>
    Array.isArray(v) && v.some((s) => s != null)
  if (anyPlaced(data.shards)) return true
  if (
    Array.isArray(data.variants) &&
    data.variants.some((v) => anyPlaced(asRecord<SavedVariant>(v)?.shards))
  )
    return true
  const formShards = data.formShards
  if (formShards && typeof formShards === "object") {
    return Object.values(formShards).some(anyPlaced)
  }
  return false
}
