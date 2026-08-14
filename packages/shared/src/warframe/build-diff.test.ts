import { describe, expect, it } from "vitest"

import { diffBuildData, mergeChanges, type BuildChange } from "./build-diff"

const mod = (name: string, rank = 5) => ({ mod: { name }, rank })

/** Minimal persisted document with one named variant. */
function doc(
  variant: Record<string, unknown>,
  top: Record<string, unknown> = {},
) {
  return {
    hasReactor: true,
    ...top,
    variants: [{ id: "v1", label: "Steel Path", ...variant }],
  }
}

const labels = (cs: BuildChange[]) => cs.map((c) => `${c.op} ${c.label}`)

describe("diffBuildData", () => {
  it("reports a mod swap as a remove and an add", () => {
    const before = doc({ slots: { n0: mod("Reach") } })
    const after = doc({ slots: { n0: mod("Pressure Point") } })
    expect(labels(diffBuildData(before, after))).toEqual([
      "remove Reach",
      "add Pressure Point",
    ])
  })

  it("scopes changes to the variant label", () => {
    const before = doc({ slots: { n0: mod("Reach") } })
    const after = doc({ slots: { n0: mod("Pressure Point") } })
    expect(diffBuildData(before, after)[0].scope).toBe("Steel Path")
  })

  it("reports a rank change as a modify, not a swap", () => {
    const before = doc({ slots: { n0: mod("Blind Rage", 6) } })
    const after = doc({ slots: { n0: mod("Blind Rage", 4) } })
    expect(diffBuildData(before, after)).toEqual([
      {
        op: "modify",
        scope: "Steel Path",
        label: "Blind Rage",
        detail: "rank 6 → 4",
      },
    ])
  })

  it("ignores a mod moved between slots", () => {
    const before = doc({ slots: { n0: mod("Reach"), n1: mod("Fury") } })
    const after = doc({ slots: { n1: mod("Reach"), n2: mod("Fury") } })
    expect(diffBuildData(before, after)).toEqual([
      { op: "info", label: "No loadout changes" },
    ])
  })

  it("collapses a newly added variant instead of listing every slot", () => {
    const before = doc({ slots: { n0: mod("Reach") } })
    const after = {
      hasReactor: true,
      variants: [
        { id: "v1", label: "Steel Path", slots: { n0: mod("Reach") } },
        {
          id: "v2",
          label: "Exterminate",
          slots: { n0: mod("Serration"), n1: mod("Split Chamber") },
        },
      ],
    }
    expect(diffBuildData(before, after)).toEqual([
      {
        op: "add",
        scope: "Exterminate",
        label: "Variant added",
        detail: "2 mods",
      },
    ])
  })

  it("reports a removed variant", () => {
    const before = {
      variants: [
        { id: "v1", label: "A", slots: {} },
        { id: "v2", label: "B", slots: {} },
      ],
    }
    const after = { variants: [{ id: "v1", label: "A", slots: {} }] }
    expect(diffBuildData(before, after)).toEqual([
      { op: "remove", scope: "B", label: "Variant removed" },
    ])
  })

  it("describes shard and helminth edits in prose", () => {
    const before = doc({
      shards: [{ color: "crimson", stat: "str", tauforged: false }, null],
      helminth: { 1: { name: "Roar" } },
    })
    const after = doc({
      shards: [{ color: "crimson", stat: "duration", tauforged: true }, null],
      helminth: { 1: { name: "Xata's Whisper" } },
    })
    expect(diffBuildData(before, after)).toEqual([
      {
        op: "modify",
        scope: "Steel Path",
        label: "Archon Shards",
        detail: "1 of 2 changed",
      },
      {
        op: "modify",
        scope: "Steel Path",
        label: "Helminth",
        detail: "Roar → Xata's Whisper",
      },
    ])
  })

  it("flags a guide-only edit, which no +/- line can describe", () => {
    const before = doc({ slots: {}, guideDescription: "old" })
    const after = doc({ slots: {}, guideDescription: "new" })
    expect(diffBuildData(before, after)).toEqual([
      { op: "info", scope: "Steel Path", label: "Guide updated" },
    ])
  })

  it("returns a single line for a save that changed nothing", () => {
    const same = doc({ slots: { n0: mod("Reach") } })
    expect(diffBuildData(same, structuredClone(same))).toEqual([
      { op: "info", label: "No loadout changes" },
    ])
  })

  it("degrades to one line rather than throwing on unreadable data", () => {
    expect(diffBuildData(null, undefined)).toEqual([
      { op: "info", label: "Updated" },
    ])
    expect(diffBuildData("nonsense", 42)).toEqual([
      { op: "info", label: "Updated" },
    ])
  })

  it("handles legacy documents with no variants array", () => {
    const before = { slots: { n0: mod("Reach") }, hasReactor: true }
    const after = { slots: { n0: mod("Reach") }, hasReactor: false }
    expect(diffBuildData(before, after)).toEqual([
      { op: "modify", label: "Reactor removed", detail: "capacity changed" },
    ])
  })

  it("caps a mass edit", () => {
    const many = (prefix: string) =>
      Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => [`n${i}`, mod(`${prefix}${i}`)]),
      )
    const changes = diffBuildData(
      doc({ slots: many("a") }),
      doc({ slots: many("b") }),
    )
    expect(changes).toHaveLength(41)
    expect(changes.at(-1)).toEqual({
      op: "info",
      label: "…and 80 more changes",
    })
  })
})

describe("mergeChanges", () => {
  it("cancels a mod added then removed across a burst", () => {
    expect(
      mergeChanges([
        [{ op: "add", label: "Reach" }],
        [{ op: "remove", label: "Reach" }],
      ]),
    ).toEqual([{ op: "info", label: "No loadout changes" }])
  })

  it("keeps the latest state of a repeatedly edited entry", () => {
    expect(
      mergeChanges([
        [{ op: "modify", label: "Blind Rage", detail: "rank 5 → 6" }],
        [{ op: "modify", label: "Blind Rage", detail: "rank 6 → 4" }],
      ]),
    ).toEqual([{ op: "modify", label: "Blind Rage", detail: "rank 6 → 4" }])
  })

  it("drops no-op saves but keeps real ones alongside them", () => {
    expect(
      mergeChanges([
        [{ op: "info", label: "No loadout changes" }],
        [{ op: "add", label: "Serration" }],
        [{ op: "info", label: "No loadout changes" }],
      ]),
    ).toEqual([{ op: "add", label: "Serration" }])
  })

  it("keeps same-label changes in different variants apart", () => {
    const merged = mergeChanges([
      [{ op: "add", scope: "A", label: "Reach" }],
      [{ op: "remove", scope: "B", label: "Reach" }],
    ])
    expect(merged).toHaveLength(2)
  })
})
