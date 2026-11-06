import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"
import { describe, expect, it } from "vitest"

import type { ExtrasState } from "@/lib/build/extras"

import { makeEditorCapture } from "./editor-capture"

const variant = (id: string, formIndex?: number): SavedVariant => ({
  id,
  label: id,
  slots: {},
  arcanes: [],
  shards: [],
  formIndex,
})

const capture = (variants: SavedVariant[], clampedActiveIndex: number) =>
  makeEditorCapture({
    variantMode: "independent",
    variants,
    clampedActiveIndex,
    slots: { placed: {}, formaPolarities: {} },
    arcanes: { placed: [] },
    extras: { shards: [] } as unknown as ExtrasState,
    buildDescription: "",
    allMods: [],
    allArcanes: [],
  }).captureBuildData()

describe("captureBuildData", () => {
  // scripts/recompute-forma.ts counts against this mirror.
  it("mirrors the active variant's form at the top level", () => {
    const variants = [variant("a", 0), variant("b", 1)]
    expect(capture(variants, 1).formIndex).toBe(1)
    expect(capture(variants, 0).formIndex).toBe(0)
  })

  it("leaves it absent for a normal frame", () => {
    expect(capture([variant("a")], 0).formIndex).toBeUndefined()
  })
})
