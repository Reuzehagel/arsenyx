/**
 * Compare two `items-index.json` snapshots (and per-item detail dirs)
 * record-by-record. Snapshot a known-good build to `data/golden/`, then diff
 * a new build's `apps/web/public/data/` against it: an empty diff means no
 * regressions, and any reported delta is either an intended change or a
 * regression to investigate.
 *
 * `data/golden/` is a LOCAL scratch dir (gitignored) — it's a copy of a
 * generated build, so never commit it. Re-snapshot before a diff session:
 *   rm -rf data/golden && cp -r apps/web/public/data data/golden
 *
 * Usage:
 *   bun run scripts/diff-index.ts <golden-dir> <new-dir>
 *
 * Each directory should contain `items-index.json` (and may contain
 * `items/<category>/<slug>.json` per-item details — those are diffed too if
 * present in both sides).
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"

interface BrowseItem {
  uniqueName: string
  name: string
  slug: string
  category: string
  [key: string]: unknown
}
type IndexShape = Partial<Record<string, BrowseItem[]>>

function loadIndex(dir: string): IndexShape {
  const path = resolve(dir, "items-index.json")
  return JSON.parse(readFileSync(path, "utf8"))
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (typeof a === "object") {
    const ka = Object.keys(a as object).sort()
    const kb = Object.keys(b as object).sort()
    if (ka.length !== kb.length) return false
    if (!ka.every((k, i) => k === kb[i])) return false
    return ka.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    )
  }
  return false
}

/** Per-field counter for summary mode. */
interface FieldDelta {
  /** count of items where this field changed (any kind of change) */
  changed: number
  /** count where field exists in golden but not new (removed) */
  removed: number
  /** count where field exists in new but not golden (added) */
  added: number
  /** sample (old, new) value pair for the first divergence — for orientation */
  sample?: { old: unknown; new: unknown; slug: string }
}

function diffItem(
  category: string,
  a: BrowseItem,
  b: BrowseItem,
  summary: Map<string, Map<string, FieldDelta>>,
  emitPerItem: boolean,
): string[] {
  const fields = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: string[] = []
  for (const f of fields) {
    if (!deepEqual(a[f], b[f])) {
      if (emitPerItem) {
        out.push(
          `    ${category}/${a.slug}.${f}: ${JSON.stringify(a[f])} -> ${JSON.stringify(b[f])}`,
        )
      }
      // Aggregate for summary mode
      if (!summary.has(category)) summary.set(category, new Map())
      const cat = summary.get(category)!
      if (!cat.has(f)) cat.set(f, { changed: 0, removed: 0, added: 0 })
      const d = cat.get(f)!
      d.changed++
      if (f in a && !(f in b)) d.removed++
      else if (!(f in a) && f in b) d.added++
      if (!d.sample) d.sample = { old: a[f], new: b[f], slug: a.slug }
    }
  }
  return out
}

function compareIndex(
  goldenDir: string,
  newDir: string,
  summaryMode: boolean,
): {
  diffs: number
  summary: Map<string, Map<string, FieldDelta>>
} {
  const a = loadIndex(goldenDir)
  const b = loadIndex(newDir)
  const cats = new Set([...Object.keys(a), ...Object.keys(b)])
  const summary = new Map<string, Map<string, FieldDelta>>()

  let differences = 0
  for (const cat of [...cats].sort()) {
    const aArr = a[cat] ?? []
    const bArr = b[cat] ?? []
    const aBySlug = new Map(aArr.map((i) => [i.slug, i] as const))
    const bBySlug = new Map(bArr.map((i) => [i.slug, i] as const))
    const slugs = new Set([...aBySlug.keys(), ...bBySlug.keys()])

    const onlyA: string[] = []
    const onlyB: string[] = []
    const changed: string[] = []
    for (const s of [...slugs].sort()) {
      const ia = aBySlug.get(s)
      const ib = bBySlug.get(s)
      if (ia && !ib) onlyA.push(s)
      else if (!ia && ib) onlyB.push(s)
      else if (ia && ib) {
        const itemDiffs = diffItem(cat, ia, ib, summary, !summaryMode)
        if (itemDiffs.length > 0) {
          changed.push(s)
          differences += itemDiffs.length
          for (const d of itemDiffs) console.log(d)
        }
      }
    }
    if (onlyA.length || onlyB.length || changed.length) {
      console.log(
        `  ${cat}: ${aArr.length} -> ${bArr.length}` +
          (onlyA.length ? ` | removed: ${onlyA.length}` : "") +
          (onlyB.length ? ` | added: ${onlyB.length}` : "") +
          (changed.length ? ` | changed: ${changed.length}` : ""),
      )
      if (onlyA.length)
        console.log(
          `    removed: ${onlyA.slice(0, 10).join(", ")}${onlyA.length > 10 ? ", ..." : ""}`,
        )
      if (onlyB.length)
        console.log(
          `    added:   ${onlyB.slice(0, 10).join(", ")}${onlyB.length > 10 ? ", ..." : ""}`,
        )
      differences += onlyA.length + onlyB.length
    }
  }
  return { diffs: differences, summary }
}

function printSummary(summary: Map<string, Map<string, FieldDelta>>): void {
  console.log("\n=== Field-level deltas ===")
  // Aggregate across categories first
  const global = new Map<string, FieldDelta>()
  for (const cat of summary.values()) {
    for (const [field, d] of cat) {
      const g = global.get(field) ?? { changed: 0, removed: 0, added: 0 }
      g.changed += d.changed
      g.removed += d.removed
      g.added += d.added
      if (!g.sample && d.sample) g.sample = d.sample
      global.set(field, g)
    }
  }
  const rows = [...global.entries()].sort((a, b) => b[1].changed - a[1].changed)
  for (const [field, d] of rows) {
    const sample = d.sample
      ? ` (e.g. ${d.sample.slug}: ${JSON.stringify(d.sample.old)} -> ${JSON.stringify(d.sample.new)})`
      : ""
    let kind = ""
    if (d.removed === d.changed) kind = " [field gone from new]"
    else if (d.added === d.changed) kind = " [field added in new]"
    console.log(
      `  ${field.padEnd(14)} ${String(d.changed).padStart(4)} items${kind}${sample}`,
    )
  }
}

function compareDetail(goldenDir: string, newDir: string): number {
  const gDetails = resolve(goldenDir, "items")
  const nDetails = resolve(newDir, "items")
  let gExists = false
  try {
    gExists = statSync(gDetails).isDirectory()
  } catch {}
  let nExists = false
  try {
    nExists = statSync(nDetails).isDirectory()
  } catch {}
  if (!gExists || !nExists) {
    if (gExists !== nExists) {
      console.log(
        `  items/ dir presence differs (golden: ${gExists}, new: ${nExists})`,
      )
      return 1
    }
    return 0
  }

  let differences = 0
  for (const cat of readdirSync(gDetails)) {
    const gCat = resolve(gDetails, cat)
    const nCat = resolve(nDetails, cat)
    let nCatExists = false
    try {
      nCatExists = statSync(nCat).isDirectory()
    } catch {}
    if (!nCatExists) {
      console.log(`  items/${cat}/ exists in golden, missing in new`)
      differences++
      continue
    }
    const gFiles = new Set(readdirSync(gCat).filter((f) => f.endsWith(".json")))
    const nFiles = new Set(readdirSync(nCat).filter((f) => f.endsWith(".json")))
    const all = new Set([...gFiles, ...nFiles])
    for (const f of all) {
      if (!gFiles.has(f)) {
        console.log(`  items/${cat}/${f}: only in new`)
        differences++
        continue
      }
      if (!nFiles.has(f)) {
        console.log(`  items/${cat}/${f}: only in golden`)
        differences++
        continue
      }
      const g = JSON.parse(readFileSync(resolve(gCat, f), "utf8"))
      const n = JSON.parse(readFileSync(resolve(nCat, f), "utf8"))
      if (!deepEqual(g, n)) {
        const gFields = new Set(Object.keys(g))
        const nFields = new Set(Object.keys(n))
        const allFields = new Set([...gFields, ...nFields])
        for (const fld of allFields) {
          if (!deepEqual(g[fld], n[fld])) {
            console.log(`  items/${cat}/${f}.${fld} differs`)
            differences++
          }
        }
      }
    }
  }
  return differences
}

function main() {
  const args = process.argv.slice(2)
  const summaryMode = args.includes("--summary")
  const positional = args.filter((a) => !a.startsWith("--"))
  const goldenDir = positional[0]
  const newDir = positional[1]
  if (!goldenDir || !newDir) {
    console.error(
      "Usage: bun run scripts/diff-index.ts [--summary] <golden-dir> <new-dir>",
    )
    process.exit(1)
  }
  console.log(
    `Comparing ${goldenDir} vs ${newDir}${summaryMode ? " (summary)" : ""}`,
  )
  console.log()
  const { diffs: indexDiffs, summary } = compareIndex(
    goldenDir,
    newDir,
    summaryMode,
  )
  // Detail comparison is skipped in summary mode — per-item details are too
  // verbose to summarize meaningfully without per-category schema knowledge.
  const detailDiffs = summaryMode ? 0 : compareDetail(goldenDir, newDir)
  if (summaryMode) printSummary(summary)
  const total = indexDiffs + detailDiffs
  console.log()
  if (total === 0) {
    console.log("OK  no differences")
    process.exit(0)
  }
  console.log(`${total} difference(s) total`)
  process.exit(1)
}

main()
