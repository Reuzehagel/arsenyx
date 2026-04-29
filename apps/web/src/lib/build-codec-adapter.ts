import type {
  Arcane,
  BrowseCategory,
  BuildState,
  LichBonusElement,
  Mod,
  ModSlot,
  PlacedArcane as SharedPlacedArcane,
  PlacedMod as SharedPlacedMod,
  Polarity,
} from "@arsenyx/shared/warframe/types"

import type { PlacedArcane, PlacedMod, SlotId } from "@/components/build-editor"
import type { SavedBuildData } from "@/lib/build-query"
import type { HelminthAbility } from "@/lib/helminth-query"
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
  lichBonusElement?: LichBonusElement
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  normalSlotCount: number
  auraSlotCount: number
}

function toSharedPlacedMod(p: PlacedMod): SharedPlacedMod {
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
  if (shared.rivenStats) {
    const mod: Mod = {
      uniqueName: shared.uniqueName,
      name: shared.name || "Riven Mod",
      imageName: shared.imageName,
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
  type: "aura" | "exilus" | "normal",
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
          rarity: a.arcane.rarity,
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
    normalSlots,
    arcaneSlots,
    shardSlots: state.shards,
    baseCapacity: 0,
    currentCapacity: 0,
    formaCount: 0,
    buildName: state.buildName,
    helminthAbility,
    zawComponents: state.zawComponents,
    lichBonusElement: state.lichBonusElement,
    incarnonEnabled: state.incarnonEnabled,
    incarnonPerks: state.incarnonPerks,
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
      lichBonusElement: state.lichBonusElement,
      incarnonEnabled: state.incarnonEnabled,
      incarnonPerks: state.incarnonPerks,
    },
    buildName: state.buildName,
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
  return refreshHelminthImage(base, helminthAbilities)
}

// Older builds were saved when wfcd shipped content-hashed image filenames
// (e.g. `roar-e206197372.png`); the newer `@wfcd/items` package uses canonical
// names and the upstream CDN no longer maps the old hashed slugs. Mods and
// arcanes are already re-resolved via `toEditorPlacedMod` upstream, but
// `buildStateToSavedData` copies helminth fields verbatim — so refresh just
// the imageName from `helminthAbilities` to self-heal stale legacy rows.
function refreshHelminthImage(
  data: SavedBuildData,
  helminthAbilities: HelminthAbility[],
): SavedBuildData {
  if (!data.helminth || helminthAbilities.length === 0) return data
  const byUnique = new Map(helminthAbilities.map((h) => [h.uniqueName, h]))
  const next: Record<number, HelminthAbility> = {}
  for (const [slotIndex, ability] of Object.entries(data.helminth)) {
    const fresh = byUnique.get(ability.uniqueName)
    next[Number(slotIndex)] = fresh
      ? { ...ability, imageName: fresh.imageName }
      : ability
  }
  return { ...data, helminth: next }
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
