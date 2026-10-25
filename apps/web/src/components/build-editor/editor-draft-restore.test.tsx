// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render } from "@testing-library/react"
import { Window } from "happy-dom"
import { Suspense } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { saveEditorDraft, type EditorDraftPayload } from "@/lib/editor-draft"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import type { SavedBuildData } from "@/lib/queries/build-query"
import { helminthQuery } from "@/lib/queries/helminth-query"
import { incarnonAdapterImagesQuery } from "@/lib/queries/incarnon-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"
import type { DetailItem } from "@/lib/warframe"

import { resetEditorCache } from "./editor-cache"
import { useEditorHydration } from "./use-editor-hydration"
import { useEditorVariants } from "./use-editor-variants"

const STORE_KEY = "__new_build__:warframes:excalibur"

function seededClient() {
  const qc = new QueryClient()
  qc.setQueryData(itemQuery("warframes", "excalibur").queryKey, {
    name: "Excalibur",
    uniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
  } as DetailItem)
  qc.setQueryData(modsQuery.queryKey, [])
  qc.setQueryData(arcanesQuery.queryKey, [])
  qc.setQueryData(helminthQuery.queryKey, [])
  qc.setQueryData(incarnonAdapterImagesQuery.queryKey, {})
  qc.setQueryData(modConflictsQuery.queryKey, {})
  return qc
}

// Node 25 ships its own `localStorage` global (undefined without a flag) that
// shadows happy-dom's, so hand the editor a real one.
beforeEach(() => {
  vi.stubGlobal("localStorage", new Window().localStorage)
})

afterEach(() => {
  resetEditorCache()
  vi.unstubAllGlobals()
})

describe("draft restore on first load", () => {
  // Regression: on a hard load a child suspends and React throws the first
  // render away. Anything that render wrote to the module-level editor cache
  // made the retry read `localDraft` as a variant-switch remount, which
  // dropped the draft's name, guide text and "Draft restored" toast.
  it("keeps the local draft when the first render is discarded", async () => {
    saveEditorDraft(STORE_KEY, {
      buildData: {} as SavedBuildData,
      buildName: "My draft",
      guideSummary: "",
      guideDescription: "",
    })

    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    let suspended = false
    let committed: EditorDraftPayload | null | undefined

    function Probe() {
      const h = useEditorHydration({ slug: "excalibur", category: "warframes" })
      useEditorVariants({
        storeKey: h.storeKey,
        savedDataAll: h.savedDataAll,
        item: h.item,
        activeVariantIndex: 0,
      })
      // Suspend the first attempt only, like a lazy child would.
      if (!suspended) {
        suspended = true
        throw gate
      }
      committed = h.localDraft
      return null
    }

    render(
      <QueryClientProvider client={seededClient()}>
        <Suspense fallback={null}>
          <Probe />
        </Suspense>
      </QueryClientProvider>,
    )
    await act(async () => {
      release()
      await gate
    })

    expect(committed?.buildName).toBe("My draft")
  })
})
