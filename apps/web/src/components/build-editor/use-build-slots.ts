import { clamp } from "@arsenyx/shared/util/math"
import {
  auraSlotId,
  normalSlotId,
  type PlacedMod,
  type SlotId,
} from "@arsenyx/shared/warframe/build-data"
import {
  type ModConflictMap,
  modsConflict,
} from "@arsenyx/shared/warframe/mods"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { useCallback, useMemo, useState } from "react"

import type { Loadout } from "@/lib/build/loadout"
import {
  canBeAlternate,
  canPlaceIn,
  candidateSlots,
} from "@/lib/build/slot-kind"
import { getNextEmptySlot, type SlotLayout } from "@/lib/build/slot-order"
import { modMaxRank } from "@/lib/build/slot-ranks"

type PlacedMap = Partial<Record<SlotId, PlacedMod>>

/** Swap two slots' entries (or move into an empty one). Same map when the
 *  move is illegal. A mod's Alternate travels with it only where that
 *  Alternate is legal (the rule placeAt applies); otherwise it's dropped. */
export function withSwap(prev: PlacedMap, from: SlotId, to: SlotId): PlacedMap {
  if (from === to) return prev
  const a = prev[from]
  const b = prev[to]
  if (!a) return prev
  if (!canPlaceIn(a.mod, to)) return prev
  if (b && !canPlaceIn(b.mod, from)) return prev
  const moved = (e: NonNullable<typeof a>, id: SlotId) =>
    e.alternate && !canBeAlternate(e.alternate.mod, id)
      ? { mod: e.mod, rank: e.rank }
      : e
  // Annotated: spreading a Record keyed by template-literal SlotIds
  // widens to only the literal keys.
  const next: PlacedMap = { ...prev, [to]: moved(a, to) }
  if (b) next[from] = moved(b, from)
  else delete next[from]
  return next
}

/** Set slot `id`'s Alternate. No-op (same map) on an empty slot or an illegal
 *  Alternate. Rank defaults to the mod's max and is clamped to it. */
export function withAlternate(
  placed: PlacedMap,
  id: SlotId,
  mod: Mod,
  rank?: number,
): PlacedMap {
  const cur = placed[id]
  if (!cur || !canBeAlternate(mod, id)) return placed
  const max = modMaxRank(mod)
  return {
    ...placed,
    [id]: { ...cur, alternate: { mod, rank: clamp(rank ?? max, 0, max) } },
  }
}

export function withoutAlternate(placed: PlacedMap, id: SlotId): PlacedMap {
  const cur = placed[id]
  if (!cur?.alternate) return placed
  const { alternate: _drop, ...rest } = cur
  return { ...placed, [id]: rest }
}

export function withAlternateRank(
  placed: PlacedMap,
  id: SlotId,
  rank: number,
): PlacedMap {
  const cur = placed[id]
  const alt = cur?.alternate
  if (!cur || !alt) return placed
  const clamped = clamp(rank, 0, modMaxRank(alt.mod))
  if (clamped === alt.rank) return placed
  return { ...placed, [id]: { ...cur, alternate: { ...alt, rank: clamped } } }
}

/** Where a picked mod lands: the selected slot when it fits, else the first
 *  free slot of the mod's kind. Null when it's a duplicate, conflicts with an
 *  equipped mod (e.g. a second Serration variant), or nothing fits. */
function placementTarget(
  placed: PlacedMap,
  mod: Mod,
  selected: SlotId | null,
  layout: SlotLayout,
  conflictMap?: ModConflictMap,
): SlotId | null {
  const equipped = Object.values(placed).filter((p) => p !== undefined)
  if (equipped.some((p) => p.mod.name === mod.name)) return null
  if (
    conflictMap &&
    equipped.some((p) =>
      modsConflict(mod.uniqueName, p.mod.uniqueName, conflictMap),
    )
  ) {
    return null
  }
  if (selected && canPlaceIn(mod, selected)) return selected
  const auraIds = Array.from({ length: layout.auraSlotCount }, (_, i) =>
    auraSlotId(i),
  )
  const normalIds = Array.from({ length: layout.normalSlotCount }, (_, i) =>
    normalSlotId(i),
  )
  return (
    candidateSlots(mod, auraIds, normalIds).find(
      (id) => !placed[id] && canPlaceIn(mod, id),
    ) ?? null
  )
}

export interface BuildSlotsState {
  placed: PlacedMap
  usedNames: Set<string>
  selected: SlotId | null
  formaPolarities: Partial<Record<SlotId, Polarity>>
  /** False when no slot can take the mod (nothing changes). */
  place: (mod: Mod) => boolean
  /** Stamp a mod into a specific slot, overwriting it. Used for rivens and
   *  drag-drop; skips the dedupe check and doesn't move the cursor. */
  placeAt: (id: SlotId, mod: Mod, rank?: number) => void
  /** Move the cursor to the next empty slot after `from` (the riven flow
   *  calls this after `placeAt`). */
  selectNextEmpty: (from: SlotId) => void
  remove: (id: SlotId) => void
  /** Toggles: selecting the selected slot clears the selection. */
  select: (id: SlotId | null) => void
  setSelected: (id: SlotId | null) => void
  setRank: (id: SlotId, rank: number) => void
  /** `"universal"` explicitly clears the slot (overrides innate); `null`
   *  reverts to innate. */
  setForma: (id: SlotId, polarity: Polarity | null) => void
  /** Move or exchange two slots' mods. Forma stays with the slot, as in-game.
   *  Rejected when either side would break slot-kind compatibility. */
  swap: (from: SlotId, to: SlotId) => void
  /** Replace the whole map in one commit (auto-forma rearrangements, undo). */
  setPlaced: (next: PlacedMap) => void
  setFormaPolarities: (next: Partial<Record<SlotId, Polarity>>) => void
  /** Ignored for an empty slot or an illegal Alternate (see `canBeAlternate`). */
  setAlternate: (id: SlotId, mod: Mod, rank?: number) => void
  removeAlternate: (id: SlotId) => void
  setAlternateRank: (id: SlotId, rank: number) => void
}

export function useBuildSlots(
  layout: SlotLayout,
  initial: Pick<Loadout, "placed" | "formaPolarities">,
  conflictMap?: ModConflictMap,
): BuildSlotsState {
  const [placed, setPlaced] = useState<PlacedMap>(initial.placed)
  const [selected, setSelected] = useState<SlotId | null>("normal-0")
  const [formaPolarities, setFormaPolarities] = useState<
    Partial<Record<SlotId, Polarity>>
  >(initial.formaPolarities)

  const place = useCallback(
    (mod: Mod) => {
      const target = placementTarget(placed, mod, selected, layout, conflictMap)
      if (!target) return false
      setPlaced({ ...placed, [target]: { mod, rank: modMaxRank(mod) } })
      setSelected(getNextEmptySlot(target, layout, placed))
      return true
    },
    [placed, selected, layout, conflictMap],
  )

  const placeAt = useCallback((id: SlotId, mod: Mod, rank?: number) => {
    setPlaced((prev) => {
      // Keep the slot's Alternate when it's still legal beside the new mod —
      // re-editing a riven's stats re-stamps the slot through here.
      const alt = prev[id]?.alternate
      const keepAlt =
        alt &&
        alt.mod.uniqueName !== mod.uniqueName &&
        canBeAlternate(alt.mod, id)
      return {
        ...prev,
        [id]: {
          mod,
          rank: rank ?? modMaxRank(mod),
          ...(keepAlt && { alternate: alt }),
        },
      }
    })
  }, [])

  const selectNextEmpty = useCallback(
    // Scans forward from `from`, so a just-placed mod at `from` (not yet in
    // this `placed` closure) doesn't matter.
    (from: SlotId) => setSelected(getNextEmptySlot(from, layout, placed)),
    [placed, layout],
  )

  const remove = useCallback((id: SlotId) => {
    setPlaced((prev) => {
      if (!prev[id]) return prev
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const swap = useCallback((from: SlotId, to: SlotId) => {
    setPlaced((prev) => withSwap(prev, from, to))
  }, [])

  const select = useCallback((id: SlotId | null) => {
    setSelected((prev) => (prev === id ? null : id))
  }, [])

  const setRank = useCallback((id: SlotId, rank: number) => {
    setPlaced((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      const clamped = clamp(rank, 0, modMaxRank(cur.mod))
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

  const setAlternate = useCallback((id: SlotId, mod: Mod, rank?: number) => {
    setPlaced((prev) => withAlternate(prev, id, mod, rank))
  }, [])

  const removeAlternate = useCallback((id: SlotId) => {
    setPlaced((prev) => withoutAlternate(prev, id))
  }, [])

  const setAlternateRank = useCallback((id: SlotId, rank: number) => {
    setPlaced((prev) => withAlternateRank(prev, id, rank))
  }, [])

  const usedNames = useMemo(
    () => new Set(Object.values(placed).map((p) => p!.mod.name)),
    [placed],
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
    setSelected,
    setRank,
    setForma,
    swap,
    setPlaced,
    setFormaPolarities,
    setAlternate,
    removeAlternate,
    setAlternateRank,
  }
}
