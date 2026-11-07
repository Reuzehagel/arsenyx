// @vitest-environment happy-dom
import type {
  SavedBuildData,
  SavedVariant,
} from "@arsenyx/shared/warframe/build-data"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, waitFor } from "@testing-library/react"
import { Window } from "happy-dom"
import { Suspense, useEffect, useReducer } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DetailItem } from "@/lib/catalog"
import {
  clearEditorDraft,
  editorStoreKey,
  loadEditorDraft,
  loadImportDraft,
  replacedDraftKey,
  saveEditorDraft,
  saveImportDraft,
} from "@/lib/drafts"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { buildKeys } from "@/lib/queries/build-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { incarnonAdapterImagesQuery } from "@/lib/queries/incarnon-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"

import {
  useEditorStore,
  type EditorShellSearch,
  type EditorStore,
} from "./use-editor-store"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
}))

const SEARCH = { item: "excalibur", category: "warframes" } as const
const STORE_KEY = editorStoreKey(undefined, "warframes", "excalibur")

const mod = (name: string) =>
  ({ name, uniqueName: `/Mods/${name}`, fusionLimit: 5 }) as Mod

function seededClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(itemQuery("warframes", "excalibur").queryKey, {
    name: "Excalibur",
    uniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
  } as DetailItem)
  qc.setQueryData(buildKeys.detail(""), null)
  qc.setQueryData(modsQuery.queryKey, [])
  qc.setQueryData(arcanesQuery.queryKey, [])
  qc.setQueryData(helminthQuery.queryKey, [])
  qc.setQueryData(incarnonAdapterImagesQuery.queryKey, {})
  qc.setQueryData(modConflictsQuery.queryKey, {})
  return qc
}

// The latest store the editor committed.
let store: EditorStore
const publish = (s: EditorStore) => {
  store = s
}

type SessionProps = { search: EditorShellSearch; onAdopted?: () => void }

function Probe({ onReset, ...props }: SessionProps & { onReset: () => void }) {
  const s = useEditorStore({ ...props, onResetToSaved: onReset })
  useEffect(() => publish(s))
  return null
}

// Mirrors the create route: one session per key, reset re-keys it.
function Session(props: SessionProps) {
  const [resets, reseed] = useReducer((n: number) => n + 1, 0)
  return <Probe key={resets} onReset={reseed} {...props} />
}

/** Open the editor on a new Excalibur build, like visiting /create. */
function openEditor(props: Partial<SessionProps> = {}) {
  return render(
    <QueryClientProvider client={seededClient()}>
      <Suspense fallback={null}>
        <Session search={SEARCH} {...props} />
      </Suspense>
    </QueryClientProvider>,
  )
}

/** Let the 500ms undo debounce record the last edit as a history step. */
const settleHistory = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 600)))

const modIn = (slots: SavedVariant["slots"] | undefined) =>
  slots?.["normal-0"]?.mod.name

/** Wait out the autosave debounce until the stored draft satisfies `check`. */
const draftSettles = (check: (data: SavedBuildData) => boolean) =>
  waitFor(
    () => {
      const data = loadEditorDraft(STORE_KEY)?.buildData
      expect(data && check(data)).toBe(true)
    },
    { timeout: 3000 },
  )

// Node 25 ships its own `localStorage` global (undefined without a flag) that
// shadows happy-dom's, so hand the editor a real one.
beforeEach(() => {
  const win = new Window()
  vi.stubGlobal("localStorage", win.localStorage)
  vi.stubGlobal("sessionStorage", win.sessionStorage)
  vi.mocked(toast).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("build editor session", () => {
  it("keeps each variant's edits across switches", () => {
    openEditor()
    act(() => store.slots.placeAt("normal-0", mod("Serration")))
    act(() => store.variantActions.addVariant())

    expect(store.variants).toHaveLength(2)
    expect(store.clampedActiveIndex).toBe(1)
    expect(store.slots.placed).toEqual({})

    act(() => store.slots.placeAt("normal-0", mod("Hornet Strike")))
    act(() => store.variantActions.switchVariant(0))
    expect(modIn(store.slots.placed)).toBe("Serration")

    act(() => store.variantActions.switchVariant(1))
    expect(modIn(store.slots.placed)).toBe("Hornet Strike")
  })

  it("autosaves a draft when a variant is added with no other edit", async () => {
    openEditor()
    act(() => store.variantActions.addVariant())
    await draftSettles((data) => data.variants?.length === 2)
  })

  it("restores the draft, every variant included, when reopened", async () => {
    const editor = openEditor()
    act(() => store.slots.placeAt("normal-0", mod("Serration")))
    act(() => store.variantActions.addVariant())
    act(() => store.slots.placeAt("normal-0", mod("Hornet Strike")))
    await draftSettles(
      (data) => modIn(data.variants?.[1]?.slots) === "Hornet Strike",
    )
    editor.unmount()

    openEditor()
    expect(store.hasDraft).toBe(true)
    expect(store.variants).toHaveLength(2)
    expect(modIn(store.slots.placed)).toBe("Serration")
    expect(modIn(store.variants[1].slots)).toBe("Hornet Strike")
  })

  it("keeps an edit made just before leaving the editor", () => {
    const editor = openEditor()
    act(() => store.slots.placeAt("normal-0", mod("Serration")))
    // Unmount inside the 600ms autosave window.
    editor.unmount()
    expect(modIn(loadEditorDraft(STORE_KEY)?.buildData.slots)).toBe("Serration")
  })

  it("doesn't bring back a draft cleared before leaving (a save)", () => {
    const editor = openEditor()
    act(() => store.slots.placeAt("normal-0", mod("Serration")))
    clearEditorDraft(STORE_KEY)
    editor.unmount()
    expect(loadEditorDraft(STORE_KEY)).toBeNull()
  })

  it("reset to saved drops the draft and starts the session over", async () => {
    const variant = (id: string, name: string): SavedVariant => ({
      id,
      label: id,
      slots: { "normal-0": { mod: mod(name), rank: 5 } },
      arcanes: [],
      shards: [],
    })
    saveEditorDraft(STORE_KEY, {
      buildData: {
        version: 1,
        slots: {},
        variants: [variant("A", "Serration"), variant("B", "Hornet Strike")],
      } as SavedBuildData,
      buildName: "My draft",
      guideSummary: "",
      guideDescription: "",
    })
    openEditor()
    expect(store.buildName).toBe("My draft")
    expect(store.variants).toHaveLength(2)

    act(() => store.resetToSaved())

    expect(loadEditorDraft(STORE_KEY)).toBeNull()
    expect(store.hasDraft).toBe(false)
    expect(store.buildName).toBe("Excalibur")
    expect(store.variants).toHaveLength(1)
    expect(store.slots.placed).toEqual({})
  })

  it("undo after a variant switch stays inside the new variant", async () => {
    openEditor()
    act(() => store.slots.placeAt("normal-0", mod("Serration")))
    await settleHistory()
    expect(store.history.canUndo).toBe(true)

    act(() => store.variantActions.addVariant())
    expect(store.history.canUndo).toBe(false)
    act(() => store.history.undo())
    expect(store.slots.placed).toEqual({})

    act(() => store.variantActions.switchVariant(0))
    expect(modIn(store.slots.placed)).toBe("Serration")
  })

  it("carries build-wide extras over a switch and keeps per-variant ones", () => {
    openEditor()
    act(() =>
      store.setExtras({
        ...store.extras,
        hasReactor: false,
        deploymentContext: "archwing",
      }),
    )
    act(() => store.variantActions.addVariant())
    expect(store.extras.hasReactor).toBe(false)
    expect(store.extras.deploymentContext).not.toBe("archwing")

    act(() => store.variantActions.switchVariant(0))
    expect(store.extras.deploymentContext).toBe("archwing")
  })

  it("resets the slot and arcane selection on a switch", () => {
    openEditor()
    act(() => store.slots.select("normal-3"))
    act(() => store.arcanes.select(1))
    act(() => store.variantActions.addVariant())
    expect(store.slots.selected).toBe("normal-0")
    expect(store.arcanes.selected).toBeNull()
  })

  it("adopts an import as the draft and offers back the draft it replaced", () => {
    saveEditorDraft(STORE_KEY, {
      buildData: { version: 1, slots: {} } as SavedBuildData,
      buildName: "My draft",
      guideSummary: "",
      guideDescription: "",
    })
    const id = saveImportDraft({
      data: {
        version: 1,
        slots: { "normal-0": { mod: mod("Serration"), rank: 5 } },
      } as SavedBuildData,
      buildName: "Imported",
    })
    const onAdopted = vi.fn()
    openEditor({ search: { ...SEARCH, draft: id }, onAdopted })

    expect(store.buildName).toBe("Imported")
    expect(store.hasDraft).toBe(true)
    expect(onAdopted).toHaveBeenCalled()
    // A refresh (URL now without `draft`) restores the import from here.
    expect(loadEditorDraft(STORE_KEY)?.buildName).toBe("Imported")
    expect(loadImportDraft(id)).toBeNull()

    const [, opts] = vi.mocked(toast).mock.calls.at(-1)!
    const action = opts?.action as unknown as { onClick: () => void }
    act(() => action.onClick())
    expect(store.buildName).toBe("My draft")
    expect(loadEditorDraft(STORE_KEY)?.buildName).toBe("My draft")
  })

  it("keeps the replaced draft when the toast is missed and offers it on the next open", () => {
    saveEditorDraft(STORE_KEY, {
      buildData: { version: 1, slots: {} } as SavedBuildData,
      buildName: "My draft",
      guideSummary: "",
      guideDescription: "",
    })
    const id = saveImportDraft({
      data: { version: 1, slots: {} } as SavedBuildData,
      buildName: "Imported",
    })
    openEditor({ search: { ...SEARCH, draft: id } }).unmount()
    vi.mocked(toast).mockClear()

    // Toast ignored; the user comes back to this item later.
    openEditor()
    expect(store.buildName).toBe("Imported")
    const call = vi
      .mocked(toast)
      .mock.calls.find(([title]) => title === "Replaced your unsaved draft")
    const action = call?.[1]?.action as unknown as { onClick: () => void }
    act(() => action.onClick())
    expect(store.buildName).toBe("My draft")
    expect(loadEditorDraft(replacedDraftKey(STORE_KEY))).toBeNull()
  })
})
