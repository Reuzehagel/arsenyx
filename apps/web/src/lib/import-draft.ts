import type { SavedBuildData } from "@/lib/build-query"

const STORAGE_PREFIX = "arsenyx:import-draft:"

export type ImportDraft = {
  data: SavedBuildData
  buildName?: string
}

export function saveDraft(draft: ImportDraft): string {
  const id = Math.random().toString(36).slice(2, 10)
  sessionStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(draft))
  return id
}

/** Read the draft and clear it in one shot — refreshing `/create` shouldn't re-hydrate a stale import. */
export function consumeDraft(id: string | undefined): ImportDraft | null {
  if (!id || typeof window === "undefined") return null
  const key = `${STORAGE_PREFIX}${id}`
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    sessionStorage.removeItem(key)
    return JSON.parse(raw) as ImportDraft
  } catch {
    return null
  }
}
