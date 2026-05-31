import type { SavedBuildData } from "@/lib/queries/build-query"

/**
 * Autosaved editor drafts in localStorage. Unsaved edits otherwise vanish on
 * refresh — the only recovery was the share URL. A draft is keyed by the same
 * `storeKey` the in-memory editor cache uses (`buildSlug` for an existing
 * build, `__new_build__:<category>:<slug>` for a not-yet-saved one), so each
 * build/new-build session gets its own bucket.
 *
 * The payload is the same `buildData` shape we persist on save, plus the
 * build name and guide. Restoring just feeds it back through the editor's
 * normal hydration path.
 */

const PREFIX = "arsenyx:editor-draft:"
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

function keyFor(storeKey: string): string {
  return `${PREFIX}${storeKey}`
}

export function loadEditorDraft(storeKey: string): EditorDraftPayload | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(keyFor(storeKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    if (parsed.v !== VERSION || !parsed.payload) {
      // Stale schema — drop it rather than risk hydrating a shape the editor
      // no longer understands.
      window.localStorage.removeItem(keyFor(storeKey))
      return null
    }
    return parsed.payload
  } catch {
    return null
  }
}

export function saveEditorDraft(
  storeKey: string,
  payload: EditorDraftPayload,
): void {
  if (typeof window === "undefined") return
  try {
    const stored: StoredDraft = { v: VERSION, savedAt: Date.now(), payload }
    window.localStorage.setItem(keyFor(storeKey), JSON.stringify(stored))
  } catch {
    // Quota or private-mode failures are non-fatal; the editor still works,
    // it just won't survive a refresh.
  }
}

export function clearEditorDraft(storeKey: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(keyFor(storeKey))
  } catch {
    /* ignore */
  }
}

/**
 * Stable JSON for equality checks: sorts object keys and drops `undefined`
 * so two payloads with the same content but different key order or absent-vs-
 * undefined fields compare equal. Used to tell whether the live editor state
 * has drifted from a known baseline (the saved build / a pristine new build).
 */
export function serializeDraft(payload: EditorDraftPayload): string {
  return JSON.stringify(canonicalize(payload))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k]
      if (v === undefined) continue
      out[k] = canonicalize(v)
    }
    return out
  }
  return value
}
