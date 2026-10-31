import { afterEach, describe, expect, it, vi } from "vitest"

import { saveEditorDraft, type EditorDraftPayload } from "./editor-draft"

// Map-backed localStorage that throws once it holds more than `cap` keys.
function fakeStorage(cap: number) {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => {
      if (!m.has(k) && m.size >= cap) throw new Error("QuotaExceededError")
      m.set(k, v)
    },
    m,
  }
}

const payload = {} as EditorDraftPayload
const draft = (savedAt: number) => JSON.stringify({ v: 1, savedAt, payload })

afterEach(() => vi.unstubAllGlobals())

describe("saveEditorDraft", () => {
  it("evicts the oldest other draft when storage is full", () => {
    const ls = fakeStorage(3)
    ls.m.set("arsenyx:editor-draft:new", draft(300))
    ls.m.set("arsenyx:editor-draft:old", draft(100))
    ls.m.set("theme", "dark")
    vi.stubGlobal("window", { localStorage: ls })

    saveEditorDraft("mine", payload)

    expect([...ls.m.keys()].sort()).toEqual([
      "arsenyx:editor-draft:mine",
      "arsenyx:editor-draft:new",
      "theme",
    ])
  })
})
