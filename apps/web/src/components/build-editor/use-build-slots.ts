import {
  getPlexusSlotKind,
  isPlexusAuraMod as sharedIsPlexusAuraMod,
  isPlexusMod as sharedIsPlexusMod,
  isStanceMod,
} from "@arsenyx/shared/warframe/mods"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { useCallback, useMemo, useState } from "react"

import { getPlexusGroupForIndex } from "./layout"
import type { ModSlotKind } from "./mod-slot"

export type SlotId = `aura-${number}` | "exilus" | "stance" | `normal-${number}`

export interface PlacedMod {
  mod: Mod
  rank: number
}

export function isAuraMod(mod: Mod): boolean {
  return mod.compatName?.toUpperCase() === "AURA"
}

// Re-exported from shared so callers in the build editor can keep
// importing from this module. Casing-tolerant — see shared/mods.ts.
export const isPlexusMod = sharedIsPlexusMod
export const isPlexusAuraMod = sharedIsPlexusAuraMod

export function isExilusCompatible(mod: Mod): boolean {
  return Boolean(mod.isExilus || mod.isUtility)
}

export function slotKind(id: SlotId): ModSlotKind {
  if (id.startsWith("aura-")) return "aura"
  if (id === "exilus") return "exilus"
  if (id === "stance") return "stance"
  return "normal"
}

/** For a normal-N slot id, return the Plexus group ("battle" | "tactical" |
 * "integrated") that index falls into. Null for non-normal-N ids or for
 * indices outside PLEXUS_GROUPS' range. */
function plexusGroupForSlot(
  id: SlotId,
): "battle" | "tactical" | "integrated" | null {
  const m = /^normal-(\d+)$/.exec(id)
  if (!m) return null
  return getPlexusGroupForIndex("railjack", Number(m[1]))
}

export function canPlaceIn(mod: Mod, id: SlotId): boolean {
  // Plexus mods don't carry `compatName: "AURA"`. Aura/Matrix mods (negative
  // baseDrain) only fit the Aura slot; regular Plexus mods only fit a normal
  // slot whose Plexus group (Battle/Tactical/Integrated) matches the mod's.
  // Neither variety ever goes in exilus/stance.
  if (isPlexusMod(mod)) {
    const k = slotKind(id)
    if (isPlexusAuraMod(mod)) return k === "aura"
    if (k !== "normal") return false
    const modGroup = getPlexusSlotKind(mod)
    const slotGroup = plexusGroupForSlot(id)
    if (!modGroup || !slotGroup) return false
    return modGroup === slotGroup
  }
  switch (slotKind(id)) {
    case "aura":
      return isAuraMod(mod)
    case "exilus":
      return !isAuraMod(mod) && !isStanceMod(mod) && isExilusCompatible(mod)
    case "stance":
      return isStanceMod(mod)
    case "normal":
      return !isAuraMod(mod) && !isStanceMod(mod)
  }
}

function maxRank(mod: Mod): number {
  return mod.fusionLimit ?? 0
}

function candidateSlots(
  mod: Mod,
  auraIds: SlotId[],
  normalIds: SlotId[],
): SlotId[] {
  // Plexus mods route by sub-kind. Aura/Matrix → aura slot only; regular
  // Plexus mods → only the normal slots whose group matches the mod's group.
  // (canPlaceIn enforces the same constraint at placement time.)
  if (isPlexusMod(mod)) {
    if (isPlexusAuraMod(mod)) return auraIds
    const modGroup = getPlexusSlotKind(mod)
    if (!modGroup) return []
    return normalIds.filter((id) => plexusGroupForSlot(id) === modGroup)
  }
  if (isAuraMod(mod)) return auraIds
  if (isStanceMod(mod)) return ["stance"]
  if (isExilusCompatible(mod)) return ["exilus", ...normalIds]
  return normalIds
}

export interface SlotLayout {
  normalSlotCount: number
  auraSlotCount: number
  showExilus: boolean
  showStance: boolean
}

/**
 * Ordered list of visible slots in reading order:
 * aura-0, stance?, exilus?, aura-1..N-1, normal-0..N.
 */
export function getVisibleSlots(layout: SlotLayout): SlotId[] {
  const out: SlotId[] = []
  if (layout.auraSlotCount > 0) out.push("aura-0")
  if (layout.showStance) out.push("stance")
  if (layout.showExilus) out.push("exilus")
  for (let i = 1; i < layout.auraSlotCount; i++) {
    out.push(`aura-${i}` as SlotId)
  }
  for (let i = 0; i < layout.normalSlotCount; i++) {
    out.push(`normal-${i}` as SlotId)
  }
  return out
}

/** Next slot in reading order. Stays put if `current` is the last slot. */
export function getNextSlot(current: SlotId, layout: SlotLayout): SlotId {
  const list = getVisibleSlots(layout)
  const idx = list.indexOf(current)
  if (idx === -1 || idx >= list.length - 1) return current
  return list[idx + 1]
}

/**
 * Next empty slot in reading order after `current`. Returns null when
 * every slot from `current` onward is occupied. Cursor skips filled
 * slots so rapid mod-clicking doesn't overwrite a user's arrangement.
 */
export function getNextEmptySlot(
  current: SlotId,
  layout: SlotLayout,
  placed: Partial<Record<SlotId, PlacedMod>>,
): SlotId | null {
  const list = getVisibleSlots(layout)
  const start = list.indexOf(current)
  if (start === -1) return null
  for (let i = start + 1; i < list.length; i++) {
    if (!placed[list[i]]) return list[i]
  }
  return null
}

export interface BuildSlotsState {
  placed: Partial<Record<SlotId, PlacedMod>>
  usedNames: Set<string>
  selected: SlotId | null
  formaPolarities: Partial<Record<SlotId, Polarity>>
  place: (mod: Mod) => void
  /**
   * Stamp a mod directly into a specific slot, overwriting whatever was
   * there. Used for rivens, where we replace a freshly-placed synthetic
   * with a fully-configured one (and for re-editing). Skips the
   * usedNames dedupe check.
   */
  placeAt: (id: SlotId, mod: Mod, rank?: number) => void
  /**
   * Move the selected slot to the next empty one in reading order after
   * `from`. `placeAt` deliberately doesn't advance the cursor (drag / arcane
   * placement must stay put); the riven flow calls this after `placeAt` so a
   * follow-up mod click doesn't overwrite the freshly placed riven.
   */
  selectNextEmpty: (from: SlotId) => void
  remove: (id: SlotId) => void
  select: (id: SlotId | null) => void
  setRank: (id: SlotId, rank: number) => void
  /**
   * Apply a forma to the slot. Pass `"universal"` to explicitly clear the
   * slot (overrides innate). Pass `null` to revert to innate (no forma).
   */
  setForma: (id: SlotId, polarity: Polarity | null) => void
  /**
   * Swap or move a placed mod between two slots. If the destination is
   * empty, this is a move. If both slots are filled, mods exchange places.
   * Forma polarities stay with the slot, not the mod — matching how the
   * game treats forma. Rejects swaps that would violate slot-kind
   * compatibility on either side.
   */
  swap: (from: SlotId, to: SlotId) => void
  /**
   * Replace the entire placed-mod map. Used by auto-forma stages 2/3 to
   * commit a planned rearrangement atomically — multiple `placeAt`/`remove`
   * calls would batch React renders but still serialize through React's
   * setState queue, which made the in-between states briefly visible.
   */
  setPlaced: (next: Partial<Record<SlotId, PlacedMod>>) => void
}

export function useBuildSlots(
  normalSlotCount: number,
  initial?: {
    placed?: Partial<Record<SlotId, PlacedMod>>
    formaPolarities?: Partial<Record<SlotId, Polarity>>
    auraSlotCount?: number
    showExilus?: boolean
    showStance?: boolean
    /** Set to null for read-only views that shouldn't start with a focused slot. */
    initialSelected?: SlotId | null
  },
): BuildSlotsState {
  const [placed, setPlaced] = useState<Partial<Record<SlotId, PlacedMod>>>(
    () => initial?.placed ?? {},
  )
  const [selected, setSelected] = useState<SlotId | null>(
    () => initial?.initialSelected ?? "normal-0",
  )
  const [formaPolarities, setFormaPolarities] = useState<
    Partial<Record<SlotId, Polarity>>
  >(() => initial?.formaPolarities ?? {})

  const auraSlotCount = initial?.auraSlotCount ?? 0
  const layout: SlotLayout = {
    normalSlotCount,
    auraSlotCount,
    showExilus: initial?.showExilus ?? false,
    showStance: initial?.showStance ?? false,
  }

  const place = useCallback(
    (mod: Mod) => {
      setPlaced((prev) => {
        if (Object.values(prev).some((p) => p?.mod.name === mod.name)) {
          return prev
        }

        if (selected && canPlaceIn(mod, selected)) {
          setSelected(getNextEmptySlot(selected, layout, prev))
          return { ...prev, [selected]: { mod, rank: maxRank(mod) } }
        }

        const auraIds = Array.from(
          { length: auraSlotCount },
          (_, i) => `aura-${i}` as SlotId,
        )
        const normalIds = Array.from(
          { length: normalSlotCount },
          (_, i) => `normal-${i}` as SlotId,
        )
        const tryIds = candidateSlots(mod, auraIds, normalIds)

        for (const id of tryIds) {
          if (!prev[id] && canPlaceIn(mod, id)) {
            setSelected(getNextEmptySlot(id, layout, prev))
            return { ...prev, [id]: { mod, rank: maxRank(mod) } }
          }
        }
        return prev
      })
    },
    // layout is derived from `initial` options that are stable per editor
    // mount; no need to include every field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      normalSlotCount,
      selected,
      layout.auraSlotCount,
      layout.showExilus,
      layout.showStance,
    ],
  )

  const placeAt = useCallback((id: SlotId, mod: Mod, rank?: number) => {
    setPlaced((prev) => ({
      ...prev,
      [id]: { mod, rank: rank ?? maxRank(mod) },
    }))
  }, [])

  const selectNextEmpty = useCallback(
    (from: SlotId) => {
      // getNextEmptySlot scans forward from `from`, so a just-placed mod at
      // `from` (not yet visible in this `placed` closure) doesn't matter.
      setSelected(getNextEmptySlot(from, layout, placed))
    },
    // layout is derived from `initial` options that are stable per editor
    // mount; `placed` is the meaningful dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placed, normalSlotCount, auraSlotCount],
  )

  const remove = useCallback((id: SlotId) => {
    setPlaced((prev) => {
      if (!prev[id]) return prev
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const swap = useCallback((from: SlotId, to: SlotId) => {
    if (from === to) return
    setPlaced((prev) => {
      const a = prev[from]
      const b = prev[to]
      if (!a) return prev
      if (!canPlaceIn(a.mod, to)) return prev
      if (b && !canPlaceIn(b.mod, from)) return prev
      // Annotate explicitly: spreading a Record keyed by template-literal
      // SlotIds widens to only the literal keys, which then can't be indexed
      // by an arbitrary SlotId below.
      const next: Partial<Record<SlotId, PlacedMod>> = { ...prev, [to]: a }
      if (b) {
        next[from] = b
      } else {
        delete next[from]
      }
      return next
    })
  }, [])

  const select = useCallback((id: SlotId | null) => {
    setSelected((prev) => (prev === id ? null : id))
  }, [])

  const setRank = useCallback((id: SlotId, rank: number) => {
    setPlaced((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      const clamped = Math.max(0, Math.min(maxRank(cur.mod), rank))
      if (clamped === cur.rank) return prev
      return { ...prev, [id]: { ...cur, rank: clamped } }
    })
  }, [])

  const setForma = useCallback((id: SlotId, polarity: Polarity | null) => {
    setFormaPolarities((prev) => {
      if (polarity === null) {
        if (!(id in prev)) return prev
        const { [id]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: polarity }
    })
  }, [])

  const usedNames = useMemo(
    () => new Set(Object.values(placed).map((p) => p!.mod.name)),
    [placed],
  )

  const setPlacedAll = useCallback(
    (next: Partial<Record<SlotId, PlacedMod>>) => {
      setPlaced(next)
    },
    [],
  )

  return {
    placed,
    usedNames,
    selected,
    formaPolarities,
    place,
    placeAt,
    selectNextEmpty,
    remove,
    select,
    setRank,
    setForma,
    swap,
    setPlaced: setPlacedAll,
  }
}
