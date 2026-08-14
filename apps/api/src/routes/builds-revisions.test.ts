import type { BuildChange } from "@arsenyx/shared/warframe/build-diff"
import { describe, expect, it } from "vitest"

import { describeEdit, foldRevisions, type RevisionRow } from "./builds"

const editor = (id: string) => ({
  id,
  name: id,
  username: id,
  displayUsername: id,
  image: null,
})

const MIN = 60_000
const base = new Date("2026-08-14T12:00:00Z").getTime()

/** Rows come out of the query newest-first; `agoMin` mirrors that. */
function row(
  id: string,
  agoMin: number,
  editorId: string | null,
  changes: BuildChange[] = [],
  extra: Partial<RevisionRow> = {},
): RevisionRow {
  return {
    id,
    createdAt: new Date(base - agoMin * MIN),
    kind: "EDITED",
    note: null,
    changes,
    editor: editorId ? editor(editorId) : null,
    ...extra,
  }
}

describe("foldRevisions", () => {
  it("folds a burst of same-editor saves into one entry", () => {
    const folded = foldRevisions([
      row("r3", 1, "cyn", [{ op: "add", label: "Serration" }]),
      row("r2", 5, "cyn", []),
      row("r1", 9, "cyn", []),
    ])
    expect(folded).toHaveLength(1)
    expect(folded[0].saves).toBe(3)
    expect(folded[0].id).toBe("r3")
    expect(folded[0].changes).toEqual([{ op: "add", label: "Serration" }])
  })

  it("keeps different editors apart even back to back", () => {
    const folded = foldRevisions([row("r2", 1, "reuze"), row("r1", 2, "cyn")])
    expect(folded.map((f) => f.saves)).toEqual([1, 1])
  })

  it("breaks the fold once the window is exceeded", () => {
    const folded = foldRevisions([
      row("r3", 0, "cyn"),
      row("r2", 20, "cyn"),
      // 45 min from the group head — outside the 30 min window.
      row("r1", 45, "cyn"),
    ])
    expect(folded.map((f) => f.saves)).toEqual([2, 1])
  })

  it("never folds the CREATED entry into an edit", () => {
    const folded = foldRevisions([
      row("r2", 1, "cyn"),
      row("r1", 2, "cyn", [], { kind: "CREATED" }),
    ])
    expect(folded).toHaveLength(2)
    expect(folded[1].kind).toBe("CREATED")
  })

  it("merges the burst's change lists, cancelling in-then-out edits", () => {
    const folded = foldRevisions([
      row("r2", 1, "cyn", [{ op: "remove", label: "Reach" }]),
      row("r1", 3, "cyn", [{ op: "add", label: "Reach" }]),
    ])
    expect(folded[0].changes).toEqual([
      { op: "info", label: "No loadout changes" },
    ])
  })

  it("collects the notes of a folded burst, newest first, deduped", () => {
    const folded = foldRevisions([
      row("r3", 1, "cyn", [], { note: "fixed duration" }),
      row("r2", 3, "cyn", []),
      row("r1", 5, "cyn", [], { note: "fixed duration" }),
    ])
    expect(folded[0].notes).toEqual(["fixed duration"])
  })

  it("groups anonymous (deleted-account) rows together, not with named ones", () => {
    const folded = foldRevisions([
      row("r3", 1, null),
      row("r2", 2, null),
      row("r1", 3, "cyn"),
    ])
    expect(folded.map((f) => f.saves)).toEqual([2, 1])
    expect(folded[0].editor).toBeNull()
  })

  it("returns nothing for an empty log", () => {
    expect(foldRevisions([])).toEqual([])
  })
})

describe("describeEdit", () => {
  const existing = {
    buildData: { variants: [{ id: "v1", label: "A", slots: {} }] },
    name: "Old name",
    visibility: "PUBLIC" as const,
    buildGuide: { summary: "s", description: "d" },
  }

  it("records a rename that touched no slots", () => {
    expect(describeEdit(existing, { name: "New name" }, null)).toEqual([
      { op: "modify", label: "Renamed", detail: "Old name → New name" },
    ])
  })

  it("records a visibility change", () => {
    expect(describeEdit(existing, { visibility: "PRIVATE" }, null)).toEqual([
      { op: "modify", label: "Visibility", detail: "PUBLIC → PRIVATE" },
    ])
  })

  it("drops the no-op placeholder when a real change rode along", () => {
    const changes = describeEdit(
      existing,
      { buildData: existing.buildData, name: "New name" },
      null,
    )
    expect(changes).toEqual([
      { op: "modify", label: "Renamed", detail: "Old name → New name" },
    ])
  })

  it("keeps the no-op line when genuinely nothing changed", () => {
    expect(
      describeEdit(existing, { buildData: existing.buildData }, null),
    ).toEqual([{ op: "info", label: "No loadout changes" }])
  })

  it("falls back to a generic line for an edit it can't describe", () => {
    expect(describeEdit(existing, { hasShards: true }, null)).toEqual([
      { op: "info", label: "Updated" },
    ])
  })

  // The editor sends `guide` on every save, so presence means nothing.
  it("ignores a guide resent unchanged", () => {
    expect(
      describeEdit(
        existing,
        { buildData: existing.buildData },
        { summary: "s", description: "d" },
      ),
    ).toEqual([{ op: "info", label: "No loadout changes" }])
  })

  it("records a guide whose content actually moved", () => {
    expect(
      describeEdit(
        existing,
        { buildData: existing.buildData },
        { summary: "s", description: "rewritten" },
      ),
    ).toEqual([{ op: "info", label: "Guide updated" }])
  })

  it("reports the loadout diff when buildData moved", () => {
    const after = {
      variants: [
        {
          id: "v1",
          label: "A",
          slots: { n0: { mod: { name: "Serration" }, rank: 10 } },
        },
      ],
    }
    expect(describeEdit(existing, { buildData: after }, null)).toEqual([
      { op: "add", scope: "A", label: "Serration", detail: "rank 10" },
    ])
  })
})
