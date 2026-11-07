import { useSyncExternalStore } from "react"

import { STORAGE_KEYS, storageGet, storageSet } from "@/lib/util/storage"

export type BuildLayout = "cards" | "rows"

const STORAGE_KEY = STORAGE_KEYS.buildLayout
const EVENT = "arsenyx:build-layout-change"
const DEFAULT: BuildLayout = "cards"

function read(): BuildLayout {
  const raw = storageGet(STORAGE_KEY)
  return raw === "rows" || raw === "cards" ? raw : DEFAULT
}

function subscribe(cb: () => void) {
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
    // Same-tab listeners fire even when the write fails.
    storageSet(STORAGE_KEY, next)
    window.dispatchEvent(new Event(EVENT))
  }
  return [layout, set]
}
