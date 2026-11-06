import { encodeBuildDoc } from "@arsenyx/shared/warframe/build-codec"
import type { SavedBuildData } from "@arsenyx/shared/warframe/build-data"
import type { BuildDoc } from "@arsenyx/shared/warframe/build-doc"
import { describe, expect, it } from "vitest"

import { loadBuildData } from "@/lib/codec/build-codec-adapter"

import { hydrateShare, resolveSavedDataAll } from "./use-editor-hydration"

const normalize = (raw: unknown) => loadBuildData(raw, {})
const build = (hasReactor: boolean, extra: Partial<SavedBuildData> = {}) =>
  ({ version: 1, slots: {}, hasReactor, ...extra }) as SavedBuildData

const sources = {
  importDraft: null,
  localDraft: null,
  savedBuild: null,
  share: null,
}

describe("what the editor starts from", () => {
  it("an Overframe import beats a draft, the saved build and a share link", () => {
    const result = resolveSavedDataAll(
      {
        importDraft: build(false, { operatorAmp: "import" }),
        localDraft: { raw: build(true) },
        savedBuild: { raw: build(true) },
        share: build(true),
      },
      normalize,
    )
    expect(result.operatorAmp).toBe("import")
  })

  it("an autosaved draft overrides the saved build", () => {
    const result = resolveSavedDataAll(
      {
        ...sources,
        localDraft: { raw: build(false, { focusSchool: "draft" }) },
        savedBuild: { raw: build(true, { focusSchool: "saved" }) },
      },
      normalize,
    )
    expect(result.focusSchool).toBe("draft")
  })

  it("editing a saved build ignores a share link, even when its data is empty", () => {
    const result = resolveSavedDataAll(
      {
        ...sources,
        savedBuild: { raw: null },
        share: build(false, { focusSchool: "share" }),
      },
      normalize,
    )
    expect(result.focusSchool).toBeUndefined()
  })

  it("a share link seeds a new build", () => {
    const shared = build(false, { focusSchool: "share" })
    expect(resolveSavedDataAll({ ...sources, share: shared }, normalize)).toBe(
      shared,
    )
  })

  it("a new build starts blank", () => {
    expect(resolveSavedDataAll(sources, normalize)).toEqual({})
  })
})

describe("hydrateShare", () => {
  const doc = (buildName?: string): BuildDoc => ({
    itemUniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
    itemName: "Excalibur",
    itemCategory: "warframes",
    hasReactor: true,
    buildName,
    variants: [
      {
        id: "v0",
        label: "Main",
        auraSlots: [{ id: "aura-0", type: "aura" }],
        normalSlots: [],
        arcaneSlots: [],
        shardSlots: [],
      },
    ],
  })

  it("carries the share link's build name", () => {
    expect(
      hydrateShare(encodeBuildDoc(doc("Slash Cali")), [], [])?.buildName,
    ).toBe("Slash Cali")
  })

  it("is null for a link that doesn't decode", () => {
    expect(hydrateShare("not-a-build", [], [])).toBeNull()
  })
})
