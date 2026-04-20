import { useEffect } from "react"

/**
 * Listen for `-`/`+` while `enabled`, firing `onDelta(-1)` or `onDelta(1)`.
 * Ignores keypresses inside editable elements so the rank doesn't shift
 * while the user is typing in a search box.
 */
export function useRankHotkey({
  enabled,
  onDelta,
}: {
  enabled: boolean
  onDelta: (delta: -1 | 1) => void
}) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable)
          return
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        onDelta(-1)
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        onDelta(1)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [enabled, onDelta])
}
