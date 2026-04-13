"use client"

import { useEffect, useCallback } from "react"

interface UseBuildKeyboardOptions {
  onSelectSlot: (slotId: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  onCopyBuild: () => void
  onClearBuild: () => void
  auraSlotCount: number
  hasExilusSlot: boolean
}

/**
 * Keyboard shortcuts for build editor:
 * - 1-8: Select normal slot
 * - A: Select aura slot (if warframe)
 * - E: Select exilus slot
 * - C: Copy build link
 * - X: Clear build
 * - Escape: Deselect slot / clear focus
 */
export function useBuildKeyboard({
  onSelectSlot,
  onOpenSearch,
  onCloseSearch,
  onCopyBuild,
  onClearBuild,
  auraSlotCount,
  hasExilusSlot,
}: UseBuildKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') !== null

      // Also ignore if a dialog is open
      const dialogOpen = document.querySelector('[role="dialog"]') !== null

      if (isEditable || dialogOpen) {
        // Only handle Escape to close/deselect
        if (e.key === "Escape") {
          onCloseSearch()
        }
        return
      }

      // Escape deselects the active slot
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseSearch()
        return
      }

      // Number keys 1-8 for normal slots
      if (e.key >= "1" && e.key <= "8") {
        e.preventDefault()
        const slotIndex = parseInt(e.key) - 1
        onSelectSlot(`normal-${slotIndex}`)
        onOpenSearch()
        return
      }

      // Letter shortcuts
      switch (e.key.toLowerCase()) {
        case "a":
          if (auraSlotCount > 0) {
            e.preventDefault()
            onSelectSlot("aura-0")
            onOpenSearch()
          }
          break
        case "e":
          if (hasExilusSlot) {
            e.preventDefault()
            onSelectSlot("exilus-0")
            onOpenSearch()
          }
          break
        case "c":
          if (e.ctrlKey || e.metaKey) {
            // Let default copy behavior through
            return
          }
          e.preventDefault()
          onCopyBuild()
          break
        case "x":
          e.preventDefault()
          onClearBuild()
          break
      }
    },
    [
      onSelectSlot,
      onOpenSearch,
      onCloseSearch,
      onCopyBuild,
      onClearBuild,
      auraSlotCount,
      hasExilusSlot,
    ],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
