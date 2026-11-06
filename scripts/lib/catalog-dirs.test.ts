import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { diffCatalogDirs } from "./catalog-dirs"

const dirs: string[] = []
function catalog(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "catalog-"))
  dirs.push(dir)
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe("diffCatalogDirs", () => {
  test("identical builds differing only in meta generatedAt are equal", () => {
    const a = catalog({
      "meta.json": '{"generatedAt":"1","counts":{"x":1}}',
      "items/warframes/a.json": "{}",
    })
    const b = catalog({
      "meta.json": '{"generatedAt":"2","counts":{"x":1}}',
      "items/warframes/a.json": "{}",
    })
    expect(diffCatalogDirs(a, b)).toEqual([])
  })

  test("reports changed, added and removed files", () => {
    const a = catalog({
      "meta.json": '{"generatedAt":"1","counts":{"x":1}}',
      "mods-all.json": "[1]",
      "gone.json": "{}",
    })
    const b = catalog({
      "meta.json": '{"generatedAt":"1","counts":{"x":2}}',
      "mods-all.json": "[2]",
      "new.json": "{}",
    })
    expect(diffCatalogDirs(a, b)).toEqual([
      "- gone.json",
      "~ meta.json",
      "~ mods-all.json",
      "+ new.json",
    ])
  })
})
