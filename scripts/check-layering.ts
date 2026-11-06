/**
 * CI guard: imports only point at layers that change less than the importer.
 * The rules (and why each exists) live in scripts/lib/layering.ts.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { findLayerViolations } from "./lib/layering"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const ROOTS = [
  "apps/web/src",
  "apps/api/src",
  "packages/shared/src",
  "data/curated",
]
const SKIP = new Set(["node_modules", "generated"])

function* sourceFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* sourceFiles(p)
    else if (/\.tsx?$/.test(e.name)) yield p
  }
}

let count = 0
for (const root of ROOTS) {
  for (const abs of sourceFiles(resolve(REPO_ROOT, root))) {
    const file = relative(REPO_ROOT, abs).replaceAll("\\", "/")
    for (const v of findLayerViolations(file, readFileSync(abs, "utf8"))) {
      count++
      console.error(
        `✗ ${v.file}:${v.line} imports ${v.target}\n  ${v.rule.why}`,
      )
    }
  }
}

if (count > 0) {
  console.error(
    `\n${count} import(s) break the layering in scripts/lib/layering.ts.`,
  )
  process.exit(1)
}

console.log("✓ every import points at a more stable layer")
