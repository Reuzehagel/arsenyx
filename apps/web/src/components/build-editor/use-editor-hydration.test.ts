import { describe, expect, it } from "vitest"

import type { SavedBuildData } from "@/lib/queries/build-query"

import { resolveSavedDataAll } from "./use-editor-hydration"

const tag = (name: string) => ({ tag: name }) as unknown as SavedBuildData
const normalize = (raw: unknown) =>
  ({ normalized: raw }) as unknown as SavedBuildData
const none = {
  importDraft: null,
  localDraft: null,
  savedBuild: null,
  share: null,
}

describe("resolveSavedDataAll", () => {
  it("prefers import draft, then local draft, saved build, share", () => {
    const all = {
      importDraft: tag("import"),
      localDraft: { raw: "local" },
      savedBuild: { raw: "saved" },
      share: tag("share"),
    }
    expect(resolveSavedDataAll(all, normalize)).toEqual({ tag: "import" })
    expect(
      resolveSavedDataAll({ ...all, importDraft: null }, normalize),
    ).toEqual({ normalized: "local" })
    expect(
      resolveSavedDataAll(
        { ...all, importDraft: null, localDraft: null },
        normalize,
      ),
    ).toEqual({ normalized: "saved" })
    expect(
      resolveSavedDataAll({ ...none, share: tag("share") }, normalize),
    ).toEqual({ tag: "share" })
  })

  it("a saved build with empty buildData still beats a share link", () => {
    expect(
      resolveSavedDataAll(
        { ...none, savedBuild: { raw: null }, share: tag("share") },
        normalize,
      ),
    ).toEqual({ normalized: null })
  })

  it("falls back to an empty build", () => {
    expect(resolveSavedDataAll(none, normalize)).toEqual({})
  })
})
