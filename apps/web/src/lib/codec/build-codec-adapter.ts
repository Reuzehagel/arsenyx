/**
 * Adapters between the three build representations. They are deliberately
 * distinct — each is shaped for its job — so this is the map of which converter
 * bridges which pair, not redundancy to collapse:
 *
 *   - BuildDoc / BuildVariant (@arsenyx/shared/warframe/build-doc) — the compact
 *     share-link wire format (v1/v2 base64). Optimized for URL size.
 *   - SavedBuildData / SavedVariant (@/lib/queries/build-query) — the DB JSON
 *     column + editor state. Flat Record<SlotId,…> for keyed editor lookups;
 *     keeps top-level fields mirroring the active variant for legacy clients.
 *   - BuildState (@arsenyx/shared/warframe/types) — the in-memory lingua franca
 *     the stat / capacity / forma engines and the codec all speak.
 *
 * Conversion graph (→ = function that crosses the boundary):
 *
 *   share link ─decodeBuildDoc→ BuildDoc ─projectVariant→ BuildState
 *                                  ─buildStateToSavedData→ SavedBuildData → editor
 *   DB JSON ─normalizeBuildData→ SavedBuildData ─savedDataToBuildState→ BuildState
 *   editor ─captureBuildData→ SavedBuildData ─stripPersistedImages→ DB JSON
 *   BuildState ─encodeBuild / buildStateToBuildDoc+encodeBuildDoc→ share link
 *
 * Within SavedBuildData, getVariants / selectVariant move between the top-level
 * mirror and a chosen variant; per-variant data is threaded through the single
 * pickPerVariantData choke point below. The codec itself (build-codec.ts) shares
 * one slot/meta primitive set across v1 and v2, so the wire formats can't drift.
 */
import { RIVEN_IMAGE_NAME } from "@arsenyx/shared/warframe/rivens"
import type {
  Arcane,
  BrowseCategory,
  BuildState,
  DeploymentContext,
  LichBonusElement,
  Mod,
  ModSlot,
  PlacedArcane as SharedPlacedArcane,
  PlacedMod as SharedPlacedMod,
  Polarity,
} from "@arsenyx/shared/warframe/types"

import type { PlacedArcane, PlacedMod, SlotId } from "@/components/build-editor"
import type {
  PerVariantDataField,
  SavedBuildData,
  SavedVariant,
} from "@/lib/queries/build-query"
import type { HelminthAbility } from "@/lib/queries/helminth-query"
import type { PlacedShard } from "@/lib/shards"

type EditorState = {
  item: { uniqueName: string; name: string; imageName?: string }
  category: BrowseCategory
  buildName?: string
  hasReactor: boolean
  slots: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  arcanes: (PlacedArcane | null)[]
  shards: (PlacedShard | null)[]
  helminth: Record<number, HelminthAbility>
  zawComponents?: { grip: string; link: string }
  kitgunComponents?: { grip: string; loader: string }
  lichBonusElement?: LichBonusElement
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  deploymentContext?: DeploymentContext
  normalSlotCount: number
  auraSlotCount: number
  showStance: boolean
}

function toSharedPlacedMod(p: PlacedMod): SharedPlacedMod {
  // Explicit field list (rather than spread) so a future `Mod` field doesn't
  // silently leak into the saved payload — TS will fail to compile if a
  // required `SharedPlacedMod` field is missing here.
  const m = p.mod
  return {
    uniqueName: m.uniqueName,
    name: m.name,
    imageName: m.imageName,
    polarity: m.polarity,
    baseDrain: m.baseDrain,
    fusionLimit: m.fusionLimit,
    rank: p.rank,
    rarity: m.rarity,
    compatName: m.compatName,
    type: m.type,
    levelStats: m.levelStats,
    modSet: m.modSet,
    modSetStats: m.modSetStats,
    isExilus: m.isExilus,
    isUtility: m.isUtility,
    rivenStats: m.rivenStats,
  }
}

function toEditorPlacedMod(
  shared: SharedPlacedMod,
  modsByName: Map<string, Mod>,
): PlacedMod | null {
  // Rivens come with a stub uniqueName and rivenStats attached; preserve as-is.
  // Older saved builds carry the legacy hashed riven imageName (e.g.
  // rifle-riven-mod-e05c5519f1.png) that the upstream CDN no longer hosts — pin to the
  // current RIVEN_IMAGE_NAME so they self-heal on next render.
  if (shared.rivenStats) {
    const mod: Mod = {
      uniqueName: shared.uniqueName,
      name: shared.name || "Riven Mod",
      imageName: RIVEN_IMAGE_NAME,
      polarity: shared.polarity,
      rarity: "Riven",
      baseDrain: shared.baseDrain,
      fusionLimit: shared.fusionLimit || 8,
      compatName: shared.compatName,
      type: shared.type ?? "",
      tradable: false,
      rivenStats: shared.rivenStats,
    }
    return { mod, rank: shared.rank }
  }
  const mod = modsByName.get(shared.uniqueName)
  if (!mod) return null
  return { mod, rank: shared.rank }
}

function buildSlot(
  id: string,
  type: "aura" | "exilus" | "stance" | "normal",
  placed: PlacedMod | undefined,
  forma: Polarity | undefined,
): ModSlot {
  const slot: ModSlot = { id, type }
  if (forma) slot.formaPolarity = forma
  if (placed) slot.mod = toSharedPlacedMod(placed)
  return slot
}

export function savedDataToBuildState(state: EditorState): BuildState {
  const auraSlots: ModSlot[] = Array.from(
    { length: state.auraSlotCount },
    (_, i) => {
      const id = `aura-${i}` as SlotId
      return buildSlot(id, "aura", state.slots[id], state.formaPolarities[id])
    },
  )
  const exilusSlot = buildSlot(
    "exilus",
    "exilus",
    state.slots.exilus,
    state.formaPolarities.exilus,
  )
  const stanceSlot = state.showStance
    ? buildSlot(
        "stance",
        "stance",
        state.slots.stance,
        state.formaPolarities.stance,
      )
    : undefined
  const normalSlots: ModSlot[] = Array.from(
    { length: state.normalSlotCount },
    (_, i) => {
      const id = `normal-${i}` as SlotId
      return buildSlot(
        `normal-${i}`,
        "normal",
        state.slots[id],
        state.formaPolarities[id],
      )
    },
  )

  const arcaneSlots: (SharedPlacedArcane | null)[] = state.arcanes.map((a) =>
    a
      ? {
          uniqueName: a.arcane.uniqueName,
          name: a.arcane.name,
          imageName: a.arcane.imageName,
          rank: a.rank,
        }
      : null,
  )

  const helminthEntry = Object.entries(state.helminth)[0]
  const helminthAbility = helminthEntry
    ? {
        slotIndex: Number(helminthEntry[0]),
        ability: {
          uniqueName: helminthEntry[1].uniqueName,
          name: helminthEntry[1].name,
          source: helminthEntry[1].source,
          imageName: helminthEntry[1].imageName,
          description: helminthEntry[1].description,
        },
      }
    : undefined

  return {
    itemUniqueName: state.item.uniqueName,
    itemName: state.item.name,
    itemCategory: state.category,
    itemImageName: state.item.imageName,
    hasReactor: state.hasReactor,
    auraSlots,
    exilusSlot,
    stanceSlot,
    normalSlots,
    arcaneSlots,
    shardSlots: state.shards,
    baseCapacity: 0,
    currentCapacity: 0,
    formaCount: 0,
    buildName: state.buildName,
    helminthAbility,
    zawComponents: state.zawComponents,
    kitgunComponents: state.kitgunComponents,
    lichBonusElement: state.lichBonusElement,
    incarnonEnabled: state.incarnonEnabled,
    incarnonPerks: state.incarnonPerks,
    deploymentContext: state.deploymentContext,
  }
}

export function buildStateToSavedData(
  state: Partial<BuildState>,
  mods: Mod[],
  arcanes: Arcane[],
): { data: SavedBuildData; buildName?: string } {
  const modsByName = new Map(mods.map((m) => [m.uniqueName, m]))
  const arcanesByName = new Map(arcanes.map((a) => [a.uniqueName, a]))

  const slots: Partial<Record<SlotId, PlacedMod>> = {}
  const formaPolarities: Partial<Record<SlotId, Polarity>> = {}

  const assign = (id: SlotId, slot: ModSlot | undefined) => {
    if (!slot) return
    if (slot.formaPolarity) formaPolarities[id] = slot.formaPolarity
    if (slot.mod) {
      const placed = toEditorPlacedMod(slot.mod, modsByName)
      if (placed) slots[id] = placed
    }
  }

  // Pre-Jade builds stored a singular auraSlot. Newer builds store an array.
  const auraFallback = (state as { auraSlot?: ModSlot }).auraSlot
  const auraSlotsIn = state.auraSlots ?? (auraFallback ? [auraFallback] : [])
  auraSlotsIn.forEach((s, i) => assign(`aura-${i}` as SlotId, s))
  assign("exilus", state.exilusSlot)
  assign("stance", state.stanceSlot)
  state.normalSlots?.forEach((s, i) => assign(`normal-${i}` as SlotId, s))

  const arcanesOut: (PlacedArcane | null)[] = (state.arcaneSlots ?? []).map(
    (a) => {
      if (!a) return null
      const arcane = arcanesByName.get(a.uniqueName)
      return arcane ? { arcane, rank: a.rank } : null
    },
  )

  const helminth: Record<number, HelminthAbility> = {}
  if (state.helminthAbility) {
    helminth[state.helminthAbility.slotIndex] = {
      uniqueName: state.helminthAbility.ability.uniqueName,
      name: state.helminthAbility.ability.name,
      source: state.helminthAbility.ability.source,
      imageName: state.helminthAbility.ability.imageName,
      description: state.helminthAbility.ability.description ?? "",
    }
  }

  return {
    data: {
      version: 1,
      slots,
      formaPolarities,
      arcanes: arcanesOut,
      shards: state.shardSlots ?? [],
      hasReactor: state.hasReactor ?? true,
      helminth,
      zawComponents: state.zawComponents,
      kitgunComponents: state.kitgunComponents,
      lichBonusElement: state.lichBonusElement,
      incarnonEnabled: state.incarnonEnabled,
      incarnonPerks: state.incarnonPerks,
      deploymentContext: state.deploymentContext,
    },
    buildName: state.buildName,
  }
}

/**
 * Re-resolve every placed mod/arcane/helminth `imageName` from the current
 * catalog by its stable `uniqueName`. New-format builds carry full mod objects
 * inline (so the viewer skips the ~1.2 MB mod catalog), but those inline
 * `imageName`s were frozen at save time and rot across image-scheme changes.
 * Patching against the compact `image-map.json` self-heals them without the
 * full catalog. Legacy builds already get fresh images via `toEditorPlacedMod`,
 * so this is a no-op for them. Falls back to the stored value on a map miss.
 */
/** Apply `fn` to every mod/arcane snapshot in an optional `guideRefs` —
 *  shared by the image refresh (below) and strip (stripPersistedImages)
 *  passes so the two can't drift. The casts are safe: `fn` only adds or
 *  removes `imageName`, never changes the entry's identity. */
type GuideRefEntry = { uniqueName: string; imageName?: string }
function mapGuideRefs(
  refs: SavedBuildData["guideRefs"],
  fn: (entry: GuideRefEntry) => GuideRefEntry,
): SavedBuildData["guideRefs"] {
  if (!refs) return refs
  return {
    ...(refs.mods && { mods: refs.mods.map((m) => fn(m) as Mod) }),
    ...(refs.arcanes && { arcanes: refs.arcanes.map((a) => fn(a) as Arcane) }),
  }
}

export function refreshImagesFromMap(
  data: SavedBuildData,
  imageMap: Record<string, string> | undefined,
): SavedBuildData {
  if (!imageMap || Object.keys(imageMap).length === 0) return data
  const url = (uniqueName?: string): string | undefined =>
    uniqueName ? imageMap[uniqueName] : undefined

  const fixSlots = (
    slots: Partial<Record<SlotId, PlacedMod>> | undefined,
  ): Partial<Record<SlotId, PlacedMod>> | undefined => {
    if (!slots) return slots
    const next: Partial<Record<SlotId, PlacedMod>> = {}
    for (const [id, placed] of Object.entries(slots)) {
      if (!placed) continue
      // Rivens have a stub uniqueName that isn't in the catalog/map, so pin
      // them to the current RIVEN_IMAGE_NAME — this heals older builds that
      // stored a now-dead riven image (e.g. the bare "OmegaMod.png").
      if (placed.mod.rivenStats) {
        next[id as SlotId] = {
          ...placed,
          mod: { ...placed.mod, imageName: RIVEN_IMAGE_NAME },
        }
        continue
      }
      const fresh = url(placed.mod.uniqueName)
      next[id as SlotId] = fresh
        ? { ...placed, mod: { ...placed.mod, imageName: fresh } }
        : placed
    }
    return next
  }
  const fixArcanes = (
    arcanes: (PlacedArcane | null)[] | undefined,
  ): (PlacedArcane | null)[] | undefined =>
    arcanes?.map((a) => {
      if (!a) return a
      const fresh = url(a.arcane.uniqueName)
      return fresh ? { ...a, arcane: { ...a.arcane, imageName: fresh } } : a
    })
  const fixHelminth = (
    helminth: Record<number, HelminthAbility> | undefined,
  ): Record<number, HelminthAbility> | undefined => {
    if (!helminth) return helminth
    const next: Record<number, HelminthAbility> = {}
    for (const [slot, ability] of Object.entries(helminth)) {
      const fresh = url(ability.uniqueName)
      next[Number(slot)] = fresh ? { ...ability, imageName: fresh } : ability
    }
    return next
  }

  return {
    ...data,
    slots: fixSlots(data.slots),
    arcanes: fixArcanes(data.arcanes),
    helminth: fixHelminth(data.helminth),
    // Guide-ref snapshots persist without imageName, same as placed slots.
    guideRefs: mapGuideRefs(data.guideRefs, (entry) => {
      const fresh = url(entry.uniqueName)
      return fresh ? { ...entry, imageName: fresh } : entry
    }),
    variants: data.variants?.map((v) => ({
      ...v,
      slots: fixSlots(v.slots) ?? v.slots,
      arcanes: fixArcanes(v.arcanes) ?? v.arcanes,
      helminth: fixHelminth(v.helminth),
    })),
  }
}

/**
 * Drop the denormalized `imageName` from every placed mod/arcane/helminth
 * before a build is persisted. Images are re-resolved at render time by stable
 * `uniqueName` — the viewer via `image-map.json` (refreshImagesFromMap), the
 * editor via the full catalog (normalizeBuildData) — so the stored copy is dead
 * weight that also rots whenever the image-naming/hosting scheme changes.
 * `name` and stats stay for snapshot fidelity (vaulted entities still render).
 *
 * Rivens are the one exception: they carry a stub `uniqueName` that isn't in the
 * catalog/map, so there's nothing to re-resolve from — but their image is the
 * stable `RIVEN_IMAGE_NAME` constant that never rots, so we keep it as-is.
 */
export function stripPersistedImages(data: SavedBuildData): SavedBuildData {
  const stripMod = (placed: PlacedMod): PlacedMod => {
    if (placed.mod.rivenStats) return placed
    const { imageName: _drop, ...mod } = placed.mod
    return { ...placed, mod }
  }
  const stripSlots = (
    slots: Partial<Record<SlotId, PlacedMod>> | undefined,
  ): Partial<Record<SlotId, PlacedMod>> | undefined => {
    if (!slots) return slots
    const next: Partial<Record<SlotId, PlacedMod>> = {}
    for (const [id, placed] of Object.entries(slots)) {
      if (placed) next[id as SlotId] = stripMod(placed)
    }
    return next
  }
  const stripArcanes = (
    arcanes: (PlacedArcane | null)[] | undefined,
  ): (PlacedArcane | null)[] | undefined =>
    arcanes?.map((a) => {
      if (!a) return a
      const { imageName: _drop, ...arcane } = a.arcane
      return { ...a, arcane }
    })
  const stripHelminth = (
    helminth: Record<number, HelminthAbility> | undefined,
  ): Record<number, HelminthAbility> | undefined => {
    if (!helminth) return helminth
    const next: Record<number, HelminthAbility> = {}
    for (const [slot, ability] of Object.entries(helminth)) {
      const { imageName: _drop, ...rest } = ability
      next[Number(slot)] = rest
    }
    return next
  }

  return {
    ...data,
    slots: stripSlots(data.slots),
    arcanes: stripArcanes(data.arcanes),
    helminth: stripHelminth(data.helminth),
    guideRefs: mapGuideRefs(data.guideRefs, (entry) => {
      const { imageName: _drop, ...rest } = entry
      return rest
    }),
    variants: data.variants?.map((v) => ({
      ...v,
      slots: stripSlots(v.slots) ?? v.slots,
      arcanes: stripArcanes(v.arcanes) ?? v.arcanes,
      helminth: stripHelminth(v.helminth),
    })),
  }
}

// Pre-rewrite builds were persisted in BuildState shape (auraSlots/normalSlots/
// exilusSlot/...). The editor reads SavedBuildData. Detect and convert.
type LegacyOrSaved = Partial<BuildState> &
  SavedBuildData & { auraSlot?: unknown }

export function isLegacyBuildData(raw: unknown): boolean {
  const r = (raw ?? {}) as LegacyOrSaved
  return Boolean(
    r.normalSlots || r.auraSlots || r.auraSlot || r.exilusSlot || r.arcaneSlots,
  )
}

export function normalizeBuildData(
  raw: unknown,
  mods: Mod[],
  arcanes: Arcane[],
  helminthAbilities: HelminthAbility[] = [],
): SavedBuildData {
  const r = (raw ?? {}) as LegacyOrSaved
  const base = isLegacyBuildData(r)
    ? buildStateToSavedData(r, mods, arcanes).data
    : migrateLegacyAuraKey(r as SavedBuildData)
  const withHelminth = refreshHelminthImage(base, helminthAbilities)

  // Builds no longer persist mod/arcane `imageName` (see stripPersistedImages),
  // so re-resolve it by `uniqueName`. When a catalog is supplied — the editor
  // loads the full mods/arcanes — derive a map from it and patch. The viewer
  // passes empty catalogs to skip the ~1.2 MB download and instead calls
  // refreshImagesFromMap with the compact image-map.json after this. Legacy
  // builds already carry fresh images from buildStateToSavedData; this is an
  // idempotent confirmation for them.
  if (mods.length === 0 && arcanes.length === 0) return withHelminth
  const catalogMap: Record<string, string> = {}
  for (const m of mods) if (m.imageName) catalogMap[m.uniqueName] = m.imageName
  for (const a of arcanes)
    if (a.imageName) catalogMap[a.uniqueName] = a.imageName
  return refreshImagesFromMap(withHelminth, catalogMap)
}

// Synthetic single-variant identity used when a legacy / single-loadout build
// has no `variants` array. Save logic compares against these to decide whether
// emitting `variants` would just re-persist the synthetic placeholder.
export const SYNTHETIC_VARIANT_ID = "v0"
export const SYNTHETIC_VARIANT_LABEL = "Main"

export function isSyntheticVariant(v: SavedVariant): boolean {
  return v.id === SYNTHETIC_VARIANT_ID && v.label === SYNTHETIC_VARIANT_LABEL
}

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
 * absent on the source stay `undefined`, exactly as the prior inline code did.
 */
export function pickPerVariantData(
  src: Pick<SavedBuildData, PerVariantDataField>,
): Pick<SavedVariant, PerVariantDataField> {
  return {
    helminth: src.helminth,
    incarnonEnabled: src.incarnonEnabled,
    incarnonPerks: src.incarnonPerks,
    deploymentContext: src.deploymentContext,
    formIndex: src.formIndex,
  }
}

/**
 * Returns the variants array, or a single synthetic "Main" variant
 * synthesized from the top-level fields when the build has no
 * `variants`. Always returns at least one entry.
 */
export function getVariants(data: SavedBuildData): SavedVariant[] {
  if (data.variants && data.variants.length > 0) return data.variants
  return [
    {
      id: SYNTHETIC_VARIANT_ID,
      label: SYNTHETIC_VARIANT_LABEL,
      slots: data.slots ?? {},
      arcanes: data.arcanes ?? [],
      ...pickPerVariantData(data),
    },
  ]
}

/**
 * Resolve a form's Archon Shard set from saved build data. Form 0 (and every
 * normal frame) reads the canonical `shards`; twin-frame forms ≥ 1 read their
 * own slice of `formShards`, defaulting to empty so each "half" is independent.
 * Mirrors `shardsForForm` (build-doc.ts) for the SavedBuildData shape.
 */
export function shardsForFormSaved(
  data: Pick<SavedBuildData, "shards" | "formShards">,
  formIndex: number,
): (PlacedShard | null)[] {
  if (formIndex === 0) return data.shards ?? []
  return data.formShards?.[formIndex] ?? []
}

/**
 * Project a single variant back into a `SavedBuildData` shape that the
 * existing viewer/editor pipelines consume unchanged. Build-wide fields
 * (forma, reactor, helminth, lich, zaw, name) come from the top-level doc;
 * per-variant fields override. Shards follow the variant's form ("half"):
 * `.shards` is resolved to that form's set so the viewer renders the right
 * shards on a twin-frame, and is a no-op for normal frames.
 */
export function selectVariant(
  data: SavedBuildData,
  index: number,
): SavedBuildData {
  const variants = getVariants(data)
  const clamped =
    index < 0
      ? 0
      : index >= variants.length
        ? variants.length - 1
        : Math.floor(index)
  const v = variants[clamped]
  // Per-variant fields come from `v` verbatim. No fallback to top-level —
  // top-level mirrors whichever variant was active at save time, so falling
  // back would leak that variant's state into other variants that happen to
  // have undefined fields. Legacy single-variant docs are safe because
  // getVariants() already populates the synthetic variant from top-level.
  return {
    ...data,
    slots: v.slots,
    arcanes: v.arcanes,
    ...pickPerVariantData(v),
    // Resolve shards to the variant's form. formaPolarities, hasReactor, zaw,
    // kitgun, lich, buildName are shared across variants and stay as-is.
    shards: shardsForFormSaved(data, v.formIndex ?? 0),
  }
}

// Older builds were saved when the upstream CDN shipped content-hashed image
// filenames (e.g. `roar-e206197372.png`); the newer naming uses canonical
// names and the upstream CDN no longer maps the old hashed slugs. Mods and
// arcanes are already re-resolved via `toEditorPlacedMod` upstream, but
// `buildStateToSavedData` copies helminth fields verbatim — so refresh just
// the imageName from `helminthAbilities` to self-heal stale legacy rows.
function refreshHelminthImage(
  data: SavedBuildData,
  helminthAbilities: HelminthAbility[],
): SavedBuildData {
  if (helminthAbilities.length === 0) return data
  const byUnique = new Map(helminthAbilities.map((h) => [h.uniqueName, h]))
  const refreshOne = (
    helminth: Record<number, HelminthAbility>,
  ): Record<number, HelminthAbility> => {
    const next: Record<number, HelminthAbility> = {}
    for (const [slotIndex, ability] of Object.entries(helminth)) {
      const fresh = byUnique.get(ability.uniqueName)
      next[Number(slotIndex)] = fresh
        ? { ...ability, imageName: fresh.imageName }
        : ability
    }
    return next
  }
  let result = data
  if (data.helminth) {
    result = { ...result, helminth: refreshOne(data.helminth) }
  }
  if (data.variants && data.variants.length > 0) {
    result = {
      ...result,
      variants: data.variants.map((v) =>
        v.helminth ? { ...v, helminth: refreshOne(v.helminth) } : v,
      ),
    }
  }
  return result
}

/**
 * Builds saved before Jade's two-aura support used a bare "aura" key.
 * Rewrite it to "aura-0" so current loaders find it.
 */
function migrateLegacyAuraKey(data: SavedBuildData): SavedBuildData {
  const slots = data.slots as Partial<Record<string, PlacedMod>> | undefined
  const forma = data.formaPolarities as
    | Partial<Record<string, Polarity>>
    | undefined
  const needsSlotMigration = slots && "aura" in slots && !("aura-0" in slots)
  const needsFormaMigration = forma && "aura" in forma && !("aura-0" in forma)
  if (!needsSlotMigration && !needsFormaMigration) return data

  const nextSlots: Partial<Record<SlotId, PlacedMod>> = { ...(slots ?? {}) }
  const nextForma: Partial<Record<SlotId, Polarity>> = { ...(forma ?? {}) }
  if (needsSlotMigration) {
    const legacy = (slots as Record<string, PlacedMod>).aura
    delete (nextSlots as Record<string, unknown>).aura
    if (legacy) nextSlots["aura-0"] = legacy
  }
  if (needsFormaMigration) {
    const legacy = (forma as Record<string, Polarity>).aura
    delete (nextForma as Record<string, unknown>).aura
    if (legacy) nextForma["aura-0"] = legacy
  }
  return { ...data, slots: nextSlots, formaPolarities: nextForma }
}
