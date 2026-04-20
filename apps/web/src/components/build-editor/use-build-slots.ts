import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { useCallback, useMemo, useState } from "react"

import type { ModSlotKind } from "./mod-slot"

export type SlotId = "aura" | "exilus" | `normal-${number}`

export interface PlacedMod {
  mod: Mod
  rank: number
}

export function isAuraMod(mod: Mod): boolean {
  return mod.compatName?.toUpperCase() === "AURA"
}

export function isExilusCompatible(mod: Mod): boolean {
  return Boolean(mod.isExilus || mod.isUtility)
}

function slotKind(id: SlotId): ModSlotKind {
  if (id === "aura") return "aura"
  if (id === "exilus") return "exilus"
  return "normal"
}

function canPlaceIn(mod: Mod, id: SlotId): boolean {
  switch (slotKind(id)) {
    case "aura":
      return isAuraMod(mod)
    case "exilus":
      return !isAuraMod(mod) && isExilusCompatible(mod)
    case "normal":
      return !isAuraMod(mod)
  }
}

function maxRank(mod: Mod): number {
  return mod.fusionLimit ?? 0
}

export interface SlotLayout {
  normalSlotCount: number
  showAura: boolean
  showExilus: boolean
}

/**
 * Ordered list of visible slots in reading order: aura?, exilus?, normal-0..N.
 * Used by keyboard nav and auto-advance to step one slot forward.
 */
export function getVisibleSlots(layout: SlotLayout): SlotId[] {
  const out: SlotId[] = []
  if (layout.showAura) out.push("aura")
  if (layout.showExilus) out.push("exilus")
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
  remove: (id: SlotId) => void
  select: (id: SlotId | null) => void
  setRank: (id: SlotId, rank: number) => void
  /**
   * Apply a forma to the slot. Pass `"universal"` to explicitly clear the
   * slot (overrides innate). Pass `null` to revert to innate (no forma).
   */
  setForma: (id: SlotId, polarity: Polarity | null) => void
}

export function useBuildSlots(
  normalSlotCount: number,
  initial?: {
    placed?: Partial<Record<SlotId, PlacedMod>>
    formaPolarities?: Partial<Record<SlotId, Polarity>>
    showAura?: boolean
    showExilus?: boolean
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

  const layout: SlotLayout = {
    normalSlotCount,
    showAura: initial?.showAura ?? false,
    showExilus: initial?.showExilus ?? false,
  }

  const place = useCallback(
    (mod: Mod) => {
      setPlaced((prev) => {
        if (Object.values(prev).some((p) => p?.mod.name === mod.name)) {
          return prev
        }

        if (selected && canPlaceIn(mod, selected)) {
          setSelected(getNextSlot(selected, layout))
          return { ...prev, [selected]: { mod, rank: maxRank(mod) } }
        }

        const tryIds: SlotId[] = isAuraMod(mod)
          ? ["aura"]
          : isExilusCompatible(mod)
            ? [
                "exilus",
                ...Array.from(
                  { length: normalSlotCount },
                  (_, i) => `normal-${i}` as SlotId,
                ),
              ]
            : Array.from(
                { length: normalSlotCount },
                (_, i) => `normal-${i}` as SlotId,
              )

        for (const id of tryIds) {
          if (!prev[id] && canPlaceIn(mod, id)) {
            setSelected(getNextSlot(id, layout))
            return { ...prev, [id]: { mod, rank: maxRank(mod) } }
          }
        }
        return prev
      })
    },
    // layout is derived from `initial` options that are stable per editor
    // mount; no need to include every field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalSlotCount, selected, layout.showAura, layout.showExilus],
  )

  const placeAt = useCallback((id: SlotId, mod: Mod, rank?: number) => {
    setPlaced((prev) => ({
      ...prev,
      [id]: { mod, rank: rank ?? maxRank(mod) },
    }))
  }, [])

  const remove = useCallback((id: SlotId) => {
    setPlaced((prev) => {
      if (!prev[id]) return prev
      const { [id]: _removed, ...rest } = prev
      return rest
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

  return {
    placed,
    usedNames,
    selected,
    formaPolarities,
    place,
    placeAt,
    remove,
    select,
    setRank,
    setForma,
  }
}
