"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useCallback } from "react"

import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"

/**
 * Hook to add keyboard navigation to the browse page
 * - Number keys 1-7 switch categories
 * - Arrow keys navigate the item grid
 * - Enter opens the focused item
 */
export function useBrowseKeyboard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const switchCategory = useCallback(
    (index: number) => {
      const category = BROWSE_CATEGORIES[index]
      if (!category) return

      const params = new URLSearchParams(searchParams.toString())
      params.set("category", category.id)
      params.delete("q")
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focused on input/textarea
      const activeElement = document.activeElement
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA"

      // Number keys 1-7 for category switching (not in inputs)
      if (!isInputFocused && e.key >= "1" && e.key <= "7") {
        e.preventDefault()
        switchCategory(parseInt(e.key, 10) - 1)
        return
      }

      // Arrow key navigation for grid
      if (
        !isInputFocused &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault()

        const items = document.querySelectorAll<HTMLElement>("[data-index]")
        if (items.length === 0) return

        // Find currently focused item
        const focusedIndex = Array.from(items).findIndex(
          (item) => item === document.activeElement,
        )

        // Calculate grid columns from CSS grid
        const grid = items[0]?.parentElement
        const gridStyle = grid ? getComputedStyle(grid) : null
        const columns = gridStyle?.gridTemplateColumns?.split(" ").length || 6

        let nextIndex = focusedIndex

        switch (e.key) {
          case "ArrowRight":
            nextIndex = focusedIndex + 1
            break
          case "ArrowLeft":
            nextIndex = focusedIndex - 1
            break
          case "ArrowDown":
            nextIndex = focusedIndex + columns
            break
          case "ArrowUp":
            nextIndex = focusedIndex - columns
            break
        }

        // If no item focused, start at first
        if (focusedIndex === -1) {
          nextIndex = 0
        }

        // Clamp to valid range
        if (nextIndex >= 0 && nextIndex < items.length) {
          items[nextIndex].focus()
        }
      }

      // Enter to navigate to focused item
      if (e.key === "Enter" && !isInputFocused) {
        const focused = document.activeElement as HTMLElement
        if (focused?.hasAttribute("data-index")) {
          focused.click()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [switchCategory])
}
