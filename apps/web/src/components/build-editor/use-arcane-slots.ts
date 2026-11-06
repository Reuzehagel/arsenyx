import { clamp } from "@arsenyx/shared/util/math"
import type { PlacedArcane } from "@arsenyx/shared/warframe/build-data"
import type { Arcane } from "@arsenyx/shared/warframe/types"
import { useCallback, useMemo, useState } from "react"

import { arcaneMaxRank } from "@/lib/build/slot-ranks"

export interface ArcaneSlotsState {
  placed: (PlacedArcane | null)[]
  usedNames: Set<string>
  selected: number | null
  placeAt: (index: number, arcane: Arcane) => void
  remove: (index: number) => void
  select: (index: number | null) => void
  setSelected: (index: number | null) => void
  setRank: (index: number, rank: number) => void
  /** Replace the entire arcane array at once — used by undo/redo restore. */
  setPlaced: (next: (PlacedArcane | null)[]) => void
}

/** `initial` is already sized to the slot count (see `loadoutFromSaved`). */
export function useArcaneSlots(
  initial: (PlacedArcane | null)[],
): ArcaneSlotsState {
  const [placed, setPlaced] = useState(initial)
  const [selected, setSelected] = useState<number | null>(null)

  const placeAt = useCallback((index: number, arcane: Arcane) => {
    setPlaced((prev) => {
      if (prev.some((p) => p?.arcane.name === arcane.name)) return prev
      const next = [...prev]
      next[index] = { arcane, rank: arcaneMaxRank(arcane) }
      return next
    })
  }, [])

  const remove = useCallback((index: number) => {
    setPlaced((prev) => {
      if (!prev[index]) return prev
      const next = [...prev]
      next[index] = null
      return next
    })
  }, [])

  const select = useCallback((index: number | null) => {
    setSelected((prev) => (prev === index ? null : index))
  }, [])

  const setRank = useCallback((index: number, rank: number) => {
    setPlaced((prev) => {
      const cur = prev[index]
      if (!cur) return prev
      const clamped = clamp(rank, 0, arcaneMaxRank(cur.arcane))
      if (clamped === cur.rank) return prev
      const next = [...prev]
      next[index] = { ...cur, rank: clamped }
      return next
    })
  }, [])

  const usedNames = useMemo(
    () =>
      new Set(
        placed.filter((p): p is PlacedArcane => !!p).map((p) => p.arcane.name),
      ),
    [placed],
  )

  return {
    placed,
    usedNames,
    selected,
    placeAt,
    remove,
    select,
    setSelected,
    setRank,
    setPlaced,
  }
}
