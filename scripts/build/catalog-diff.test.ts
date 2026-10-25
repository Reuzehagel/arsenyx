import { describe, expect, test } from "bun:test"

import { summarizeCatalogDiff } from "./catalog-diff"

const mod = (uniqueName: string, name: string, description: string) => ({
  uniqueName,
  name,
  description,
})

describe("summarizeCatalogDiff", () => {
  test("reports item fields, records, report growth and skips meta", () => {
    const md = summarizeCatalogDiff([
      {
        path: "meta.json",
        before: { generatedAt: "a" },
        after: { generatedAt: "b" },
      },
      {
        path: "items-index.json",
        before: { primary: [{ uniqueName: "/A", name: "Braton" }] },
        after: {
          primary: [
            { uniqueName: "/A", name: "Braton" },
            { uniqueName: "/B", name: "Boltor" },
          ],
        },
      },
      {
        path: "items/primary/braton.json",
        before: { name: "Braton", omegaAttenuation: 1 },
        after: { name: "Braton", omegaAttenuation: 1.2 },
      },
      {
        path: "items/primary/lato.json",
        before: { name: "Lato", omegaAttenuation: 1, family: "x" },
        after: { name: "Lato", omegaAttenuation: 1.1, family: "x" },
      },
      {
        path: "mods-all.json",
        before: [
          mod("/M1", "Serration", "old"),
          mod("/M2", "Split Chamber", "s"),
        ],
        after: [
          mod("/M1", "Serration", "new"),
          mod("/M3", "Galvanized Chamber", "g"),
        ],
      },
      {
        path: "_report.json",
        before: { modsUnmatched: ["X"], stats: { a: 1 } },
        after: { modsUnmatched: ["X", "Y"], stats: { a: 2 } },
      },
      { path: "mod-conflicts.json", before: { a: 1 }, after: { a: 2 } },
    ])

    expect(md).not.toContain("meta.json")
    expect(md).toContain("**primary** added: Boltor")
    expect(md).toContain("| `omegaAttenuation` | 2 | Braton: 1 → 1.2 |")
    expect(md).not.toContain("`family`")
    expect(md).toContain("- added 1: Galvanized Chamber")
    expect(md).toContain("- removed 1: Split Chamber")
    expect(md).toContain("- changed 1: Serration")
    expect(md).toContain("**modsUnmatched** +1: Y")
    expect(md).toContain("`mod-conflicts.json`")
  })

  test("empty diff", () => {
    expect(summarizeCatalogDiff([])).toBe("No catalog changes.")
  })
})
