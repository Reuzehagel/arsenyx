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
 *   bun run data:patch <base-dir> <fixed-dir> [target-dir]
 *
 * target-dir defaults to apps/web/public/data. Arrays of records are matched by
 * `uniqueName`; string arrays as sets; other arrays are replaced whole. Skips
 * meta.json (run `data:stamp` after) and _report.json (diagnostics only).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import { findJsonFiles } from "./build/image-hosts"

const SKIP = new Set(["meta.json", "_report.json"])

type Json = unknown
type Rec = Record<string, Json>

const isRec = (v: Json): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b)
const keyOf = (v: Json) =>
  isRec(v) && typeof v.uniqueName === "string" ? v.uniqueName : undefined

/** Apply the base→fixed delta onto head. `log` collects human-readable paths. */
function patch(
  head: Json,
  base: Json,
  fixed: Json,
  path: string,
  log: string[],
): Json {
  if (same(base, fixed)) return head
  if (Array.isArray(head) && Array.isArray(base) && Array.isArray(fixed)) {
    if ([...base, ...fixed].every((v) => keyOf(v) !== undefined)) {
      const b = new Map(base.map((v) => [keyOf(v)!, v]))
      const f = new Map(fixed.map((v) => [keyOf(v)!, v]))
      const out: Json[] = []
      for (const h of head) {
        const k = keyOf(h)
        if (k === undefined || !b.has(k)) out.push(h)
        else if (!f.has(k)) log.push(`${path}[${k}] removed`)
        else out.push(patch(h, b.get(k), f.get(k), `${path}[${k}]`, log))
      }
      for (const [k, v] of f) {
        if (b.has(k)) continue
        if (head.some((h) => keyOf(h) === k)) continue
        out.push(v)
        log.push(`${path}[${k}] added`)
      }
      return out
    }
    if ([...base, ...fixed].every((v) => typeof v === "string")) {
      const removed = base.filter((v) => !fixed.includes(v))
      const added = fixed.filter((v) => !base.includes(v) && !head.includes(v))
      for (const v of removed) log.push(`${path} -${String(v)}`)
      for (const v of added) log.push(`${path} +${String(v)}`)
      const out = [...head.filter((v) => !removed.includes(v)), ...added]
      const wasSorted = head.every(
        (v, i) => i === 0 || String(head[i - 1]) <= String(v),
      )
      return wasSorted ? (out as string[]).sort() : out
    }
  } else if (isRec(head) && isRec(base) && isRec(fixed)) {
    const out: Rec = { ...head }
    for (const k of new Set([...Object.keys(base), ...Object.keys(fixed)])) {
      if (same(base[k], fixed[k])) continue
      if (!(k in fixed)) {
        delete out[k]
        log.push(`${path}.${k} removed`)
      } else if (k in head && k in base) {
        out[k] = patch(head[k], base[k], fixed[k], `${path}.${k}`, log)
      } else {
        out[k] = fixed[k]
        log.push(`${path}.${k} = ${JSON.stringify(fixed[k])}`)
      }
    }
    return out
  }
  log.push(`${path}: ${JSON.stringify(head)} → ${JSON.stringify(fixed)}`)
  return fixed
}

const [baseDir, fixedDir, targetArg] = process.argv.slice(2)
if (!baseDir || !fixedDir) {
  console.error("usage: bun run data:patch <base-dir> <fixed-dir> [target-dir]")
  process.exit(1)
}
const targetDir = resolve(targetArg ?? "apps/web/public/data")

let touched = 0
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
  for (const l of log.slice(0, 20)) console.log(`    ${l}`)
  if (log.length > 20) console.log(`    … ${log.length - 20} more`)
  touched++
}

for (const rel of findJsonFiles(resolve(baseDir)).map((p) =>
  relative(resolve(baseDir), p),
)) {
  if (!existsSync(join(resolve(fixedDir), rel)))
    manual.push(`${rel} (removed by the fix)`)
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
