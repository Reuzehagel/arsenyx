import { useHotkey } from "@/lib/hotkeys"

/**
 * Listen for `-`/`+` while `enabled`, firing `onDelta(-1)` or `onDelta(1)`.
 * Both shifted (`_`/`+`) and unshifted (`-`/`=`) variants are accepted so
 * the same physical key works regardless of whether shift is held.
 */
export function useRankHotkey({
  enabled,
  onDelta,
}: {
  enabled: boolean
  onDelta: (delta: -1 | 1) => void
}) {
  // Function matcher rather than array form: `+` only fires with shift held,
  // and the string-spec parser enforces shift state strictly.
  useHotkey(
    (e) => RANK_KEYS.has(e.key),
    (e) => onDelta(e.key === "-" || e.key === "_" ? -1 : 1),
    { enabled },
  )
}

const RANK_KEYS = new Set(["-", "_", "=", "+"])
