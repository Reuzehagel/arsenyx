import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const SCRIPT = resolve(import.meta.dirname, "../patch-catalog.ts")

function run(base: unknown, fixed: unknown, head: unknown): unknown {
  const root = mkdtempSync(join(tmpdir(), "patch-catalog-"))
  try {
    for (const [dir, data] of [
      ["base", base],
      ["fixed", fixed],
      ["head", head],
    ] as const) {
      const d = join(root, dir)
      mkdirSync(d)
      writeFileSync(join(d, "arcanes-all.json"), JSON.stringify(data))
    }
    const r = spawnSync(
      "bun",
      [
        "run",
        SCRIPT,
        join(root, "base"),
        join(root, "fixed"),
        join(root, "head"),
      ],
      { encoding: "utf8" },
    )
    expect(r.status).toBe(0)
    return JSON.parse(
      readFileSync(join(root, "head", "arcanes-all.json"), "utf8"),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const kept = { uniqueName: "/kept", rarity: "Common" }

describe("data:patch", () => {
  test("adds a record the fix introduces", () => {
    const added = { uniqueName: "/added", rarity: "Rare" }
    expect(run([kept], [kept, added], [kept])).toEqual([kept, added])
  })

  test("a re-run refreshes a record an earlier run added", () => {
    const first = { uniqueName: "/added", rarity: "Common" }
    const edited = { uniqueName: "/added", rarity: "Rare" }
    expect(run([kept], [kept, edited], [kept, first])).toEqual([kept, edited])
  })

  test("keeps a committed record upstream has since dropped", () => {
    const dropped = { uniqueName: "/dropped", rarity: "Common" }
    const edit = { uniqueName: "/kept", rarity: "Rare" }
    expect(run([kept], [edit], [kept, dropped])).toEqual([edit, dropped])
  })
})
