import { useSyncExternalStore } from "react"

export type BuildLayout = "cards" | "rows"

const STORAGE_KEY = "arsenyx-build-layout"
const EVENT = "arsenyx:build-layout-change"
const DEFAULT: BuildLayout = "cards"

function read(): BuildLayout {
  if (typeof window === "undefined") return DEFAULT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === "rows" || raw === "cards" ? raw : DEFAULT
  } catch {
    return DEFAULT
  }
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(EVENT, cb)
  }
}

export function useBuildLayout(): [BuildLayout, (next: BuildLayout) => void] {
  const layout = useSyncExternalStore(subscribe, read, () => DEFAULT)
  const set = (next: BuildLayout) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Quota / disabled — same-tab listeners still fire below.
    }
    window.dispatchEvent(new Event(EVENT))
  }
  return [layout, set]
}
