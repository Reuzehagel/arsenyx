/**
 * Adapters between the three build representations. They are deliberately
 * distinct — each is shaped for its job — so this is the map of which converter
 * bridges which pair, not redundancy to collapse:
 *
 *   - BuildDoc / BuildVariant (@arsenyx/shared/warframe/build-doc) — the compact
 *     share-link wire format (v1/v2 base64). Optimized for URL size.
 *   - SavedBuildData / SavedVariant (@arsenyx/shared/warframe/build-data) — the DB JSON
 *     column + editor state. Flat Record<SlotId,…> for keyed editor lookups;
 *     keeps top-level fields mirroring the active variant for legacy clients.
 *   - BuildState (@arsenyx/shared/warframe/types) — the in-memory lingua franca
 *     the stat / capacity / forma engines and the codec all speak.
 *
 * Conversion graph (→ = function that crosses the boundary):
 *
 *   share link ─decodeBuildDoc→ BuildDoc ─savedDataFromBuildDoc→ SavedBuildData → editor
 *   DB JSON ─loadBuildData→ SavedBuildData ─editorStateToBuildState→ BuildState
 *   editor ─captureBuildData→ SavedBuildData ─stripPersistedImages→ DB JSON
 *   editor ─buildDocFromVariants→ BuildDoc ─encodeBuildDoc→ share link (multi)
 *   BuildState ─encodeBuild→ share link (single variant)
 *
 * Within SavedBuildData, getVariants / selectVariant move between the top-level
 * mirror and a chosen variant; per-variant data is threaded through the single
 * pickPerVariantData choke point (build-data.ts). The codec itself (build-codec.ts) shares
 * one slot/meta primitive set across v1 and v2, so the wire formats can't drift.
 */
import {
  auraSlotId,
  normalSlotId,
  pickPerVariantData,
  type HelminthAbility,
  type SavedBuildData,
  type SavedVariant,
  type PlacedArcane,
  type PlacedMod,
  type SlotId,
} from "@arsenyx/shared/warframe/build-data"
import {
  clampVariantIndex,
  projectVariant,
  type BuildDoc,
} from "@arsenyx/shared/warframe/build-doc"
import {
  createSyntheticRiven,
  RIVEN_IMAGE_NAME,
} from "@arsenyx/shared/warframe/rivens"
import type {
  Arcane,
  BrowseCategory,
  BuildState,
  DeploymentContext,
  LichBonusElement,
  Mod,
  ModSlot,
  PlacedShard,
  BuildStateArcane as SharedPlacedArcane,
  BuildStateMod as SharedPlacedMod,
  Polarity,
} from "@arsenyx/shared/warframe/types"

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
  operatorAmp?: string
  focusSchool?: string
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
    const riven = createSyntheticRiven()
    const mod: Mod = {
      ...riven,
      uniqueName: shared.uniqueName,
      name: shared.name || riven.name,
      polarity: shared.polarity,
      baseDrain: shared.baseDrain,
      fusionLimit: shared.fusionLimit || riven.fusionLimit,
      compatName: shared.compatName,
      type: shared.type ?? "",
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

/** Live editor state (or a saved build projected onto it) as the BuildState
 *  the stat engines and the single-variant share codec speak. */
export function editorStateToBuildState(state: EditorState): BuildState {
  const auraSlots: ModSlot[] = Array.from(
    { length: state.auraSlotCount },
    (_, i) => {
      const id = auraSlotId(i)
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
      const id = normalSlotId(i)
      return buildSlot(id, "normal", state.slots[id], state.formaPolarities[id])
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
    operatorAmp: state.operatorAmp,
    focusSchool: state.focusSchool,
  }
}

function buildStateToSavedData(
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
  auraSlotsIn.forEach((s, i) => assign(auraSlotId(i), s))
  assign("exilus", state.exilusSlot)
  assign("stance", state.stanceSlot)
  state.normalSlots?.forEach((s, i) => assign(normalSlotId(i), s))

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
      operatorAmp: state.operatorAmp,
      focusSchool: state.focusSchool,
    },
    buildName: state.buildName,
  }
}

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

/** Apply `fn` to every mod in a slot map — each Slot's own mod and its nested
 *  Alternate — so the image refresh and strip passes treat both alike. */
function mapPlacedMods(
  slots: Partial<Record<SlotId, PlacedMod>> | undefined,
  fn: (mod: Mod) => Mod,
): Partial<Record<SlotId, PlacedMod>> | undefined {
  if (!slots) return slots
  const next: Partial<Record<SlotId, PlacedMod>> = {}
  for (const [id, placed] of Object.entries(slots)) {
    if (!placed) continue
    next[id as SlotId] = {
      ...placed,
      mod: fn(placed.mod),
      ...(placed.alternate && {
        alternate: { ...placed.alternate, mod: fn(placed.alternate.mod) },
      }),
    }
  }
  return next
}

/**
 * Re-resolve every placed mod/arcane/helminth `imageName` by its stable
 * `uniqueName`: stored `imageName`s were frozen at save time (current saves
 * drop them entirely) and rot across image-scheme changes. Falls back to the
 * stored value on a map miss. File-private: {@link loadBuildData} is the one
 * entry point.
 */
function refreshImagesFromMap(
  data: SavedBuildData,
  imageMap: Record<string, string>,
): SavedBuildData {
  if (Object.keys(imageMap).length === 0) return data
  const url = (uniqueName?: string): string | undefined =>
    uniqueName ? imageMap[uniqueName] : undefined

  const fixMod = (mod: Mod): Mod => {
    // Rivens have a stub uniqueName that isn't in the catalog/map, so pin
    // them to the current RIVEN_IMAGE_NAME — this heals older builds that
    // stored a now-dead riven image (e.g. the bare "OmegaMod.png").
    if (mod.rivenStats) return { ...mod, imageName: RIVEN_IMAGE_NAME }
    const fresh = url(mod.uniqueName)
    return fresh ? { ...mod, imageName: fresh } : mod
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
    slots: mapPlacedMods(data.slots, fixMod),
    arcanes: fixArcanes(data.arcanes),
    helminth: fixHelminth(data.helminth),
    // Guide-ref snapshots persist without imageName, same as placed slots.
    guideRefs: mapGuideRefs(data.guideRefs, (entry) => {
      const fresh = url(entry.uniqueName)
      return fresh ? { ...entry, imageName: fresh } : entry
    }),
    variants: data.variants?.map((v) => ({
      ...v,
      slots: mapPlacedMods(v.slots, fixMod) ?? v.slots,
      arcanes: fixArcanes(v.arcanes) ?? v.arcanes,
      helminth: fixHelminth(v.helminth),
    })),
  }
}

/**
 * Drop the denormalized `imageName` from every placed mod/arcane/helminth
 * before a build is persisted. Images are re-resolved at render time by stable
 * `uniqueName` by loadBuildData — the viewer from `image-map.json`, the
 * editor from the full catalog — so the stored copy is dead
 * weight that also rots whenever the image-naming/hosting scheme changes.
 * `name` and stats stay for snapshot fidelity (vaulted entities still render).
 *
 * Rivens are the one exception: they carry a stub `uniqueName` that isn't in the
 * catalog/map, so there's nothing to re-resolve from — but their image is the
 * stable `RIVEN_IMAGE_NAME` constant that never rots, so we keep it as-is.
 */
export function stripPersistedImages(data: SavedBuildData): SavedBuildData {
  const stripMod = (mod: Mod): Mod => {
    if (mod.rivenStats) return mod
    const { imageName: _drop, ...rest } = mod
    return rest
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
    slots: mapPlacedMods(data.slots, stripMod),
    arcanes: stripArcanes(data.arcanes),
    helminth: stripHelminth(data.helminth),
    guideRefs: mapGuideRefs(data.guideRefs, (entry) => {
      const { imageName: _drop, ...rest } = entry
      return rest
    }),
    variants: data.variants?.map((v) => ({
      ...v,
      slots: mapPlacedMods(v.slots, stripMod) ?? v.slots,
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

/** What {@link loadBuildData} resolves a stored build against. Every field is
 *  optional: the editor passes the full catalogs; the viewer passes only the
 *  compact `image-map.json`, plus the catalogs for a legacy build (see
 *  `catalogQueriesFor`). */
export interface BuildCatalogs {
  mods?: Mod[]
  arcanes?: Arcane[]
  helminth?: HelminthAbility[]
  /** `uniqueName → imageName`; wins over the catalogs' own images. */
  imageMap?: Record<string, string>
}

/**
 * The one way a stored build (DB JSON, possibly a legacy shape) becomes
 * `SavedBuildData`. Legacy BuildState-shape builds rebuild their mods and
 * arcanes from the catalogs (an absent catalog drops them, so pass them for
 * any build `isLegacyBuildData` flags); every build then gets its images
 * re-resolved by `uniqueName` from the catalogs and `imageMap`.
 */
export function loadBuildData(
  raw: unknown,
  { mods = [], arcanes = [], helminth = [], imageMap }: BuildCatalogs,
): SavedBuildData {
  const r = (raw ?? {}) as LegacyOrSaved
  const base = isLegacyBuildData(r)
    ? buildStateToSavedData(r, mods, arcanes).data
    : migrateLegacyAuraKey(r as SavedBuildData)
  const images: Record<string, string> = {}
  for (const entry of [...mods, ...arcanes, ...helminth]) {
    if (entry.imageName) images[entry.uniqueName] = entry.imageName
  }
  return refreshImagesFromMap(base, { ...images, ...imageMap })
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
 * Returns the variants array, or a single synthetic "Main" variant
 * synthesized from the top-level fields when the build has no
 * `variants`. Always returns at least one entry.
 *
 * Copy-on-load: a build saved before per-variant shards has variants with no
 * `shards`. Resolve each here, the single choke point both editor and viewer
 * read through, so every variant becomes independent at load — editing one
 * variant's shards can never drag a still-unmigrated sibling along via the
 * shared top-level mirror.
 */
export function getVariants(data: SavedBuildData): SavedVariant[] {
  if (data.variants && data.variants.length > 0) {
    // The common case (every variant already carries `shards`) returns the
    // array by reference; only legacy builds missing some `shards` allocate.
    if (data.variants.every((v) => v.shards)) return data.variants
    return data.variants.map((v) =>
      v.shards
        ? v
        : { ...v, shards: shardsForFormSaved(data, v.formIndex ?? 0) },
    )
  }
  return [
    {
      id: SYNTHETIC_VARIANT_ID,
      label: SYNTHETIC_VARIANT_LABEL,
      slots: data.slots ?? {},
      arcanes: data.arcanes ?? [],
      shards: data.shards ?? [],
      ...pickPerVariantData(data),
    },
  ]
}

/**
 * Copy-on-load fallback for a variant that has no `shards` of its own — i.e. a
 * build saved before per-variant shards. Resolves from the legacy top-level
 * fields: form 0 (and every normal frame) reads `shards`; a twin-frame form ≥ 1
 * reads its slice of the short-lived per-form `formShards`, falling back to
 * `shards` so the build's single saved set copies onto every variant.
 * File-private: `getVariants` is the only copy-on-load entry point.
 */
function shardsForFormSaved(
  data: Pick<SavedBuildData, "shards" | "formShards">,
  formIndex: number,
): (PlacedShard | null)[] {
  if (formIndex !== 0) {
    const forForm = data.formShards?.[formIndex]
    if (forForm) return forForm
  }
  return data.shards ?? []
}

/**
 * Project a single variant back into a `SavedBuildData` shape that the
 * existing viewer/editor pipelines consume unchanged. Build-wide fields
 * (forma, reactor, helminth, lich, zaw, name) come from the top-level doc;
 * per-variant fields override. `.shards` is the variant's own set; copy-on-load
 * for legacy builds is handled upstream in `getVariants`.
 */
export function selectVariant(
  data: SavedBuildData,
  index: number,
): SavedBuildData {
  const variants = getVariants(data)
  return projectSavedVariant(
    data,
    variants[clampVariantIndex({ variants }, index)],
  )
}

/** `v` projected onto `data`'s build-wide fields — `selectVariant` for a
 *  variant the caller already holds (the editor's in-memory array). */
export function projectSavedVariant(
  data: SavedBuildData,
  v: SavedVariant,
): SavedBuildData {
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
    // getVariants already resolved copy-on-load for legacy builds, so
    // `v.shards` is set. formaPolarities, hasReactor, zaw,
    // kitgun, lich, buildName are shared across variants and stay as-is.
    shards: v.shards ?? [],
  }
}

/**
 * Project the live editor state + its variants array into a share-link
 * `BuildDoc`. `base` carries the build-wide fields; `variants` is the
 * in-memory variants array with the active slot already replaced by the live
 * snapshot.
 *
 * Each variant's per-variant data comes from that variant alone, through
 * `pickPerVariantData` — never falling back to `base`, which mirrors the
 * active variant — so a share link decodes to what `selectVariant` shows for
 * the saved build. `helminthAbility` stays build-wide (doc top-level only;
 * `BuildVariant` has no helminth field), the inverse of `projectVariant`.
 */
export function buildDocFromVariants(
  base: EditorState,
  variants: SavedVariant[],
): BuildDoc {
  const shared = editorStateToBuildState(base)
  return {
    itemUniqueName: shared.itemUniqueName,
    itemName: shared.itemName,
    itemCategory: shared.itemCategory,
    itemImageName: shared.itemImageName,
    hasReactor: shared.hasReactor,
    helminthAbility: shared.helminthAbility,
    zawComponents: shared.zawComponents,
    kitgunComponents: shared.kitgunComponents,
    lichBonusElement: shared.lichBonusElement,
    buildName: shared.buildName,
    variants: variants.map((sv) => {
      // Forma is build-wide, so base.formaPolarities is intentionally applied
      // to every variant's projection. The variant's helminth rides along in
      // the overlay but is unread: only `shared` emits helminthAbility.
      const vs = editorStateToBuildState({
        ...base,
        slots: sv.slots,
        arcanes: sv.arcanes,
        shards: sv.shards ?? [],
        ...pickPerVariantData(sv),
        helminth: base.helminth,
      })
      return {
        id: sv.id,
        label: sv.label,
        auraSlots: vs.auraSlots,
        exilusSlot: vs.exilusSlot,
        stanceSlot: vs.stanceSlot,
        normalSlots: vs.normalSlots,
        arcaneSlots: vs.arcaneSlots,
        shardSlots: vs.shardSlots,
        incarnonEnabled: vs.incarnonEnabled,
        incarnonPerks: vs.incarnonPerks,
        deploymentContext: vs.deploymentContext,
        operatorAmp: vs.operatorAmp,
        focusSchool: vs.focusSchool,
        // formIndex isn't threaded through BuildState; twin-frame share links
        // depend on it to pick the right form.
        formIndex: sv.formIndex,
      }
    }),
  }
}

/**
 * Inverse of `buildDocFromVariants`: hydrate the editor's `SavedBuildData` from
 * a decoded share-link `BuildDoc`. A single-variant doc projects to the bare
 * top-level shape; a multi-variant doc adds the `variants` array, each variant
 * projected via `projectVariant` (which re-broadcasts the build-wide helminth)
 * and threaded through `pickPerVariantData` so the per-variant split stays in
 * lockstep with the rest of the adapter.
 */
export function savedDataFromBuildDoc(
  doc: BuildDoc,
  mods: Mod[],
  arcanes: Arcane[],
): SavedBuildData {
  const project = (i: number) =>
    buildStateToSavedData(projectVariant(doc, i), mods, arcanes).data
  // `formIndex` isn't carried through BuildState (projectVariant drops it), so
  // lift it off the decoded doc variants directly — onto the top-level mirror
  // (a single twin-frame variant on a non-primary form needs it) and each
  // projected variant.
  const activeData = { ...project(0), formIndex: doc.variants[0].formIndex }
  if (doc.variants.length === 1) return activeData
  const variants: SavedVariant[] = doc.variants.map((v, i) => {
    // i === 0 is the active variant — reuse its projection rather than
    // reconstructing the same slots a second time.
    const data = i === 0 ? activeData : project(i)
    return {
      id: v.id,
      label: v.label,
      slots: data.slots ?? {},
      arcanes: data.arcanes ?? [],
      // Shards are per-variant (projectVariant reads each variant's own
      // shardSlots), so carry each projection's set onto its variant.
      shards: data.shards ?? [],
      ...pickPerVariantData(data),
      formIndex: v.formIndex,
      guideSummary: v.guideSummary,
      guideDescription: v.guideDescription,
    }
  })
  return { ...activeData, variants }
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
