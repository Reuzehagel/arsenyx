import type { Arcane } from "@arsenyx/shared/warframe/types"
import { useCallback, useMemo, useState } from "react"

export interface PlacedArcane {
  arcane: Arcane
  rank: number
}

function maxRank(arcane: Arcane): number {
  return arcane.levelStats ? arcane.levelStats.length - 1 : 5
}

export interface ArcaneSlotsState {
  placed: (PlacedArcane | null)[]
  usedNames: Set<string>
  selected: number | null
  place: (arcane: Arcane) => void
  placeAt: (index: number, arcane: Arcane) => void
  remove: (index: number) => void
  select: (index: number | null) => void
  setRank: (index: number, rank: number) => void
}

export function useArcaneSlots(
  slotCount: number,
  initial?: (PlacedArcane | null)[],
): ArcaneSlotsState {
  const [placed, setPlaced] = useState<(PlacedArcane | null)[]>(() => {
    const base: (PlacedArcane | null)[] = Array.from(
      { length: slotCount },
      () => null,
    )
    if (initial) {
      for (let i = 0; i < Math.min(slotCount, initial.length); i++) {
        base[i] = initial[i] ?? null
      }
    }
    return base
  })
  const [selected, setSelected] = useState<number | null>(null)

  const placeAt = useCallback((index: number, arcane: Arcane) => {
    setPlaced((prev) => {
      if (prev.some((p) => p?.arcane.name === arcane.name)) return prev
      const next = [...prev]
      next[index] = { arcane, rank: maxRank(arcane) }
      return next
    })
  }, [])

  const place = useCallback(
    (arcane: Arcane) => {
      let placedInSelected = false
      setPlaced((prev) => {
        if (prev.some((p) => p?.arcane.name === arcane.name)) return prev
        const targetIdx =
          selected !== null && !prev[selected]
            ? selected
            : prev.findIndex((p) => !p)
        if (targetIdx < 0) return prev
        const next = [...prev]
        next[targetIdx] = { arcane, rank: maxRank(arcane) }
        if (selected !== null && targetIdx === selected) placedInSelected = true
        return next
      })
      if (placedInSelected) setSelected(null)
    },
    [selected],
  )

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
      const clamped = Math.max(0, Math.min(maxRank(cur.arcane), rank))
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
    place,
    placeAt,
    remove,
    select,
    setRank,
  }
}
