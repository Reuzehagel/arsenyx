/**
 * Three-way patch the committed catalog with ONLY what a pipeline fix changes.
 *
 * A full `build:items` from a fresh mirror drags in unrelated upstream drift
 * (new items, wiki edits). To ship just a fix: build the catalog twice from the
 * same mirror — once without the fix (`base`), once with it (`fixed`) — then
 * apply the base→fixed delta onto the committed files. Recipe in
 * docs/commands.md ("Shipping a pipeline fix without upstream drift").
 *
 * Usage:
 *   bun run data:patch <base-dir> <fixed-dir> [target-dir] [--verbose]
 *
 * Prints one line per patched file, then a count per changed field path with
 * record keys collapsed to `[]`; `--verbose` also prints every change.
 *
 * target-dir defaults to apps/web/public/data (or CATALOG_OUT_DIR). Arrays of records are matched by
 * `uniqueName`; string arrays as sets; other arrays are replaced whole. Skips
 * meta.json (run `data:stamp` after) and _report.json (diagnostics only).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import { CATALOG_FILES } from "@arsenyx/shared/warframe/catalog-files"

import { CATALOG_OUT_DIR } from "./build/paths"
import { patch } from "./lib/catalog-patch"
import { findJsonFiles } from "./lib/json-records"

const SKIP = new Set<string>([CATALOG_FILES.meta, CATALOG_FILES.report])

const VERBOSE = process.argv.includes("--verbose")
const [baseDir, fixedDir, targetArg] = process.argv
  .slice(2)
  .filter((a) => a !== "--verbose")
if (!baseDir || !fixedDir) {
  console.error("usage: bun run data:patch <base-dir> <fixed-dir> [target-dir]")
  process.exit(1)
}
const targetDir = targetArg ? resolve(targetArg) : CATALOG_OUT_DIR

let touched = 0
/** Changed field path, record keys collapsed: `.abilities[].stats` → count. */
const byField = new Map<string, number>()
const manual: string[] = []
for (const fixedPath of findJsonFiles(resolve(fixedDir))) {
  const rel = relative(resolve(fixedDir), fixedPath)
  if (SKIP.has(rel)) continue
  const basePath = join(resolve(baseDir), rel)
  const targetPath = join(targetDir, rel)
  const fixedText = readFileSync(fixedPath, "utf8")
  if (existsSync(basePath) && readFileSync(basePath, "utf8") === fixedText)
    continue

  if (!existsSync(basePath) || !existsSync(targetPath)) {
    // File only exists in the fixed build — the fix introduced it.
    mkdirSync(dirname(targetPath), { recursive: true })
    writeFileSync(targetPath, fixedText)
    console.log(`  NEW ${rel}`)
    touched++
    continue
  }

  const headText = readFileSync(targetPath, "utf8")
  const nl = headText.endsWith("\n") ? "\n" : ""
  const indent = /^[[{]\n/.test(headText) ? 2 : undefined
  const head = JSON.parse(headText)
  if (JSON.stringify(head, null, indent) + nl !== headText) {
    manual.push(
      `${rel} (committed file doesn't round-trip through JSON.stringify)`,
    )
    continue
  }
  const log: string[] = []
  const out = patch(
    head,
    JSON.parse(readFileSync(basePath, "utf8")),
    JSON.parse(fixedText),
    "",
    log,
  )
  if (log.length === 0) continue
  writeFileSync(targetPath, JSON.stringify(out, null, indent) + nl)
  console.log(`  ${rel}: ${log.length} change(s)`)
  for (const l of log) {
    if (VERBOSE) console.log(`    ${l}`)
    const field =
      l
        .split(/ = | removed| added| refreshed|: | [+-]/)[0]!
        .replace(/\[[^\]]*\]/g, "[]") || "(root)"
    byField.set(field, (byField.get(field) ?? 0) + 1)
  }
  touched++
}

for (const rel of findJsonFiles(resolve(baseDir)).map((p) =>
  relative(resolve(baseDir), p),
)) {
  if (!existsSync(join(resolve(fixedDir), rel)))
    manual.push(`${rel} (removed by the fix)`)
}
if (byField.size > 0) {
  console.log("\nChanged fields:")
  for (const [field, n] of [...byField].sort((a, b) => b[1] - a[1]))
    console.log(`  ${n}\t${field}`)
}
console.log(
  `\n✓ data:patch — ${touched} file(s) patched. Run \`bun run data:stamp\` next.`,
)
if (manual.length > 0) {
  console.warn(
    `  WARN patch these by hand:\n${manual.map((m) => `    - ${m}`).join("\n")}`,
  )
  process.exit(1)
}
