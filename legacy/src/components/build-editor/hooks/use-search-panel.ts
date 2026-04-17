"use client"

import { useState, useRef, useEffect, useDeferredValue } from "react"

// =============================================================================
// SHARED CONSTANTS
// =============================================================================

export const RARITY_ORDER: Record<string, number> = {
  Legendary: 0,
  Rare: 1,
  Uncommon: 2,
  Common: 3,
  Peculiar: 4,
}

export const RARITY_OPTIONS = [
  "All",
  "Legendary",
  "Rare",
  "Uncommon",
  "Common",
] as const

export type RarityFilter = (typeof RARITY_OPTIONS)[number]

// =============================================================================
// HOOK — manages search/filter/sort state, refs, and scroll-into-view
// =============================================================================

interface UseSearchPanelOptions {
  /** Initial selected index (-1 for "nothing selected", 0 for first item) */
  initialSelectedIndex?: number
  /** Default sort option */
  defaultSort?: string
}

export function useSearchPanel({
  initialSelectedIndex = 0,
  defaultSort = "Name",
}: UseSearchPanelOptions = {}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState(defaultSort)
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("All")
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex)
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery)

  return {
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    rarityFilter,
    setRarityFilter,
    sortBy,
    setSortBy,
    selectedIndex,
    setSelectedIndex,
    inputRef,
    gridRef,
  }
}

// =============================================================================
// SHARED UTILITIES — used by both ModSearchGrid and ArcaneSearchPanel
// =============================================================================

/** Clamp selectedIndex to valid range */
export function computeBoundedIndex(
  selectedIndex: number,
  itemCount: number,
): number {
  return itemCount === 0 ? 0 : Math.min(selectedIndex, itemCount - 1)
}

/** Scroll the selected grid item into view */
export function useScrollIntoView(
  gridRef: React.RefObject<HTMLDivElement | null>,
  boundedSelectedIndex: number,
) {
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const selectedItem = grid.querySelector(
      `[data-index="${boundedSelectedIndex}"]`,
    )
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest", inline: "nearest" })
    }
  }, [gridRef, boundedSelectedIndex])
}

/** Options for the shared 2-row grid keyboard handler */
interface GridKeyDownOptions {
  gridRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  itemCount: number
  boundedSelectedIndex: number
  selectedIndex: number
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>
  onEnterSelect?: (index: number) => void
}

/** Shared 2-row grid keyboard navigation (arrow keys + Enter) */
export function handleGridKeyDown(
  e: React.KeyboardEvent,
  opts: GridKeyDownOptions,
): void {
  const {
    gridRef,
    inputRef,
    itemCount,
    boundedSelectedIndex,
    selectedIndex,
    setSelectedIndex,
    onEnterSelect,
  } = opts

  if (!gridRef.current) return

  const isInputFocused = e.target === inputRef.current

  // For panels starting at -1, select first item on any arrow key
  if (
    selectedIndex === -1 &&
    ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)
  ) {
    e.preventDefault()
    setSelectedIndex(0)
    return
  }

  switch (e.key) {
    case "ArrowDown":
      if (isInputFocused) return
      e.preventDefault()
      if (itemCount > 0 && boundedSelectedIndex % 2 === 0) {
        const nextIndex = boundedSelectedIndex + 1
        if (nextIndex < itemCount) {
          setSelectedIndex(nextIndex)
        }
      }
      break
    case "ArrowUp":
      if (isInputFocused) return
      e.preventDefault()
      if (boundedSelectedIndex % 2 !== 0) {
        setSelectedIndex(boundedSelectedIndex - 1)
      }
      break
    case "ArrowRight":
      if (isInputFocused) return
      e.preventDefault()
      if (itemCount > 0) {
        setSelectedIndex((prev) => Math.min(prev + 2, itemCount - 1))
      }
      break
    case "ArrowLeft":
      if (isInputFocused) return
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 2, 0))
      break
    case "Enter":
      e.preventDefault()
      if (itemCount > 0 && selectedIndex !== -1 && onEnterSelect) {
        onEnterSelect(boundedSelectedIndex)
      }
      break
  }
}
