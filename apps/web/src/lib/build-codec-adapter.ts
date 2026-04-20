import type {
  Arcane,
  BrowseCategory,
  BuildState,
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
  normalSlotCount: number
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
  const auraSlots: ModSlot[] = [
    buildSlot("aura", "aura", state.slots.aura, state.formaPolarities.aura),
  ]
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

  // Pre-Jade builds stored a singular auraSlot.
  const auraFallback = (state as { auraSlot?: ModSlot }).auraSlot
  assign("aura", state.auraSlots?.[0] ?? auraFallback)
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
    },
    buildName: state.buildName,
  }
}

// Pre-rewrite builds were persisted in BuildState shape (auraSlots/normalSlots/
// exilusSlot/...). The editor reads SavedBuildData. Detect and convert.
type LegacyOrSaved = Partial<BuildState> &
  SavedBuildData & { auraSlot?: unknown }

export function normalizeBuildData(
  raw: unknown,
  mods: Mod[],
  arcanes: Arcane[],
): SavedBuildData {
  const r = (raw ?? {}) as LegacyOrSaved
  if (
    r.normalSlots ||
    r.auraSlots ||
    r.auraSlot ||
    r.exilusSlot ||
    r.arcaneSlots
  ) {
    return buildStateToSavedData(r, mods, arcanes).data
  }
  return r as SavedBuildData
}
