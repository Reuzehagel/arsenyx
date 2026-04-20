import { useEffect } from "react"

import { isEditableTarget } from "@/lib/utils"

import type { BuildSlotsState, SlotId, SlotLayout } from "./use-build-slots"

export type Dir = "left" | "right" | "up" | "down"

export const DIR_BY_KEY: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
}

const COLS = 4

function buildGrid(layout: SlotLayout): (SlotId | null)[][] {
  const grid: (SlotId | null)[][] = []
  if (layout.showAura || layout.showExilus) {
    const top: (SlotId | null)[] = new Array(COLS).fill(null)
    if (layout.showAura) top[0] = "aura"
    if (layout.showExilus) top[1] = "exilus"
    grid.push(top)
  }
  for (let i = 0; i < layout.normalSlotCount; i += COLS) {
    const row: (SlotId | null)[] = []
    for (let j = 0; j < COLS; j++) {
      const idx = i + j
      row.push(idx < layout.normalSlotCount ? (`normal-${idx}` as SlotId) : null)
    }
    grid.push(row)
  }
  return grid
}

function findPos(
  grid: (SlotId | null)[][],
  target: SlotId,
): [number, number] | null {
  for (let r = 0; r < grid.length; r++) {
    const c = grid[r].indexOf(target)
    if (c !== -1) return [r, c]
  }
  return null
}

function nearestInRow(row: (SlotId | null)[], col: number): SlotId | null {
  for (let d = 0; d < row.length; d++) {
    const left = col - d
    const right = col + d
    if (left >= 0 && row[left]) return row[left]
    if (right < row.length && row[right]) return row[right]
  }
  return null
}

function move(current: SlotId, dir: Dir, layout: SlotLayout): SlotId {
  const grid = buildGrid(layout)
  const pos = findPos(grid, current)
  if (!pos) return current
  const [r, c] = pos

  if (dir === "left") {
    for (let j = c - 1; j >= 0; j--) {
      const v = grid[r][j]
      if (v) return v
    }
    return current
  }
  if (dir === "right") {
    for (let j = c + 1; j < grid[r].length; j++) {
      const v = grid[r][j]
      if (v) return v
    }
    return current
  }
  if (dir === "up") {
    for (let i = r - 1; i >= 0; i--) {
      if (grid[i][c]) return grid[i][c]!
      const near = nearestInRow(grid[i], c)
      if (near) return near
    }
    return current
  }
  // down
  for (let i = r + 1; i < grid.length; i++) {
    if (grid[i][c]) return grid[i][c]!
    const near = nearestInRow(grid[i], c)
    if (near) return near
  }
  return current
}

export function useSlotKeyboardNav({
  slots,
  layout,
  enabled = true,
}: {
  slots: BuildSlotsState
  layout: SlotLayout
  enabled?: boolean
}) {
  // Pull primitives so the effect doesn't re-register on every render just
  // because `layout` is a fresh object identity from the caller.
  const { normalSlotCount, showAura, showExilus } = layout
  useEffect(() => {
    if (!enabled) return
    const layoutSnapshot: SlotLayout = {
      normalSlotCount,
      showAura,
      showExilus,
    }
    const onKey = (e: KeyboardEvent) => {
      const dir = DIR_BY_KEY[e.key]
      if (!dir) return
      if (isEditableTarget(e.target)) return
      // Mod-search grid has its own keyboard handling (Tab in, arrows cycle
      // matches, Enter places). Don't also move the editor slot selection.
      const t = e.target as HTMLElement | null
      if (t?.closest("[data-mod-search-grid]")) return
      // First arrow press after a click-outside restores selection to the
      // top-left normal slot rather than jumping a direction from there.
      if (slots.selected === null) {
        e.preventDefault()
        slots.select("normal-0")
        return
      }
      const next = move(slots.selected, dir, layoutSnapshot)
      if (next !== slots.selected) {
        e.preventDefault()
        slots.select(next)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [slots, normalSlotCount, showAura, showExilus, enabled])
}
