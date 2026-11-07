import type { SavedBuildData } from "@arsenyx/shared/warframe/build-data"
import type { BrowseCategory } from "@arsenyx/shared/warframe/types"

import {
  STORAGE_KEYS,
  storageGet,
  storageKeys,
  storageRemove,
  storageSet,
} from "@/lib/util/storage"

/**
 * The editor session's identity: the build's slug for an existing build,
 * `__new_build__:<category>:<item slug>` for a not-yet-saved one. Keys both
 * the editor session (the create route's key) and the autosaved draft
 * bucket, so each build/new-build session gets its own.
 */
export function editorStoreKey(
  buildSlug: string | undefined,
  category: BrowseCategory,
  itemSlug: string,
): string {
  return buildSlug ?? `__new_build__:${category}:${itemSlug}`
}

// ---------------- Autosaved editor drafts (localStorage)
//
// Unsaved edits otherwise vanish on refresh — the only recovery was the share
// URL. The payload is the same `buildData` shape we persist on save, plus the
// build name and guide. Restoring just feeds it back through the editor's
// normal hydration path.

const EDITOR_PREFIX = STORAGE_KEYS.editorDraftPrefix
const VERSION = 1

export type EditorDraftPayload = {
  buildData: SavedBuildData
  buildName: string
  guideSummary: string
  guideDescription: string
}

type StoredDraft = {
  v: number
  savedAt: number
  payload: EditorDraftPayload
}

export function loadEditorDraft(storeKey: string): EditorDraftPayload | null {
  const key = `${EDITOR_PREFIX}${storeKey}`
  const raw = storageGet(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredDraft
    if (parsed.v === VERSION && parsed.payload) return parsed.payload
  } catch {
    return null
  }
  // Stale schema — drop it rather than risk hydrating a shape the editor no
  // longer understands.
  storageRemove(key)
  return null
}

export function saveEditorDraft(
  storeKey: string,
  payload: EditorDraftPayload,
): void {
  const key = `${EDITOR_PREFIX}${storeKey}`
  const stored: StoredDraft = { v: VERSION, savedAt: Date.now(), payload }
  const json = JSON.stringify(stored)
  if (storageSet(key, json)) return
  // Quota full: drafts are never otherwise evicted, so drop other drafts
  // oldest-first until this one fits.
  for (const old of otherDraftKeysOldestFirst(key)) {
    storageRemove(old)
    if (storageSet(key, json)) return
  }
}

function otherDraftKeysOldestFirst(keep: string): string[] {
  return storageKeys(EDITOR_PREFIX)
    .filter((key) => key !== keep)
    .map((key) => {
      let savedAt = 0
      try {
        savedAt =
          (JSON.parse(storageGet(key) ?? "") as StoredDraft).savedAt ?? 0
      } catch {
        /* corrupt draft sorts first */
      }
      return { key, savedAt }
    })
    .sort((a, b) => a.savedAt - b.savedAt)
    .map((d) => d.key)
}

/** Draft slot holding the draft a share link or import replaced. */
export const replacedDraftKey = (storeKey: string) => `${storeKey}::replaced`

// When each draft was last cleared (this page session). A debounced write
// still pending when the editor unmounts must not bring back a draft that was
// cleared after that write was scheduled (save succeeded, draft discarded).
const clearedAt = new Map<string, number>()

export function clearEditorDraft(storeKey: string): void {
  storageRemove(`${EDITOR_PREFIX}${storeKey}`)
  clearedAt.set(storeKey, performance.now())
}

/** `performance.now()` of the last clear of this draft, or -Infinity. */
export function editorDraftClearedAt(storeKey: string): number {
  return clearedAt.get(storeKey) ?? -Infinity
}

// ---------------- Import hand-off (sessionStorage)
//
// /import parses an Overframe build and hands it to /create by id.

const IMPORT_PREFIX = STORAGE_KEYS.importDraftPrefix

type ImportDraft = {
  data: SavedBuildData
  buildName?: string
  guideDescription?: string
}

/** Stash the draft; the id goes into `/create?draft=`. When storage is
 *  unavailable the id resolves to nothing and /create opens empty. */
export function saveImportDraft(draft: ImportDraft): string {
  const id = Math.random().toString(36).slice(2, 10)
  storageSet(`${IMPORT_PREFIX}${id}`, JSON.stringify(draft), "session")
  return id
}

/** Non-destructive, so a render that suspends and re-runs still finds it; the
 *  editor clears it with `clearImportDraft` once it's saved as a local draft. */
export function loadImportDraft(id: string | undefined): ImportDraft | null {
  if (!id) return null
  const raw = storageGet(`${IMPORT_PREFIX}${id}`, "session")
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImportDraft
  } catch {
    return null
  }
}

export function clearImportDraft(id: string): void {
  storageRemove(`${IMPORT_PREFIX}${id}`, "session")
}
