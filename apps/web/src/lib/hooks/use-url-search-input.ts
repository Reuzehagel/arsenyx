import { useEffect, useRef, useState } from "react"

export const SEARCH_DEBOUNCE_MS = 200

/**
 * Controlled text input backed by a URL search param, debounced on the way out.
 *
 * The naive version of this — `useState(value)` plus `useEffect(() => setLocal(value), [value])`
 * — eats characters while you type, which is what issue #333 reported. The write
 * path is a debounce *plus* a navigation that blocks on the route loader, so the
 * incoming `value` echoes back what the user typed several hundred ms earlier;
 * re-seeding the input from that stale echo deletes everything typed since. The
 * faster you type, the more it eats.
 *
 * So: remember the last value we pushed and ignore our own echo, adopting
 * `value` only when it changed from somewhere else — back/forward, a cleared
 * filter, or a length cap applied by the route's search-param parser.
 *
 * `push` is read through a ref because callers pass it as an inline arrow. In
 * the effect deps it would change identity on every unrelated re-render, each
 * time clearing and rescheduling the timer so the push walks further and
 * further out.
 */
export function useUrlSearchInput(
  value: string,
  push: (next: string) => void,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): [string, (next: string) => void] {
  const [local, setLocal] = useState(value)

  const pushedRef = useRef(value)
  useEffect(() => {
    if (value === pushedRef.current) return
    pushedRef.current = value
    setLocal(value)
  }, [value])

  const pushRef = useRef(push)
  pushRef.current = push

  useEffect(() => {
    if (local === value) return
    const t = setTimeout(() => {
      pushedRef.current = local
      pushRef.current(local)
    }, delayMs)
    return () => clearTimeout(t)
  }, [local, value, delayMs])

  return [local, setLocal]
}
