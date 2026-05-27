/**
 * Compare two `items-index.json` snapshots (and per-item detail dirs)
 * record-by-record.
 *
 * Phase 3a: snapshot the current pipeline output to `data/golden/`, then run
 * this against `apps/web/public/data/` to verify self-equality. Empty diff
 * means the harness is wired correctly and Phase 4 has a known-good baseline
 * to diff against.
 *
 * Phase 3b: after Phase 4 lands the new build, this script reports only the
 * expected deltas (Bubonico class fix, Perigale Prime class fix, beast claws
 * added, …). Anything else is a regression.
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
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  }
  return false
}

function diffItem(
  category: string,
  a: BrowseItem,
  b: BrowseItem,
): string[] {
  const fields = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: string[] = []
  for (const f of fields) {
    if (!deepEqual(a[f], b[f])) {
      out.push(
        `    ${category}/${a.slug}.${f}: ${JSON.stringify(a[f])} -> ${JSON.stringify(b[f])}`,
      )
    }
  }
  return out
}

function compareIndex(goldenDir: string, newDir: string): number {
  const a = loadIndex(goldenDir)
  const b = loadIndex(newDir)
  const cats = new Set([...Object.keys(a), ...Object.keys(b)])

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
        const itemDiffs = diffItem(cat, ia, ib)
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
      if (onlyA.length) console.log(`    removed: ${onlyA.slice(0, 10).join(", ")}${onlyA.length > 10 ? ", ..." : ""}`)
      if (onlyB.length) console.log(`    added:   ${onlyB.slice(0, 10).join(", ")}${onlyB.length > 10 ? ", ..." : ""}`)
      differences += onlyA.length + onlyB.length
    }
  }
  return differences
}

function compareDetail(goldenDir: string, newDir: string): number {
  const gDetails = resolve(goldenDir, "items")
  const nDetails = resolve(newDir, "items")
  let gExists = false
  try { gExists = statSync(gDetails).isDirectory() } catch {}
  let nExists = false
  try { nExists = statSync(nDetails).isDirectory() } catch {}
  if (!gExists || !nExists) {
    if (gExists !== nExists) {
      console.log(`  items/ dir presence differs (golden: ${gExists}, new: ${nExists})`)
      return 1
    }
    return 0
  }

  let differences = 0
  for (const cat of readdirSync(gDetails)) {
    const gCat = resolve(gDetails, cat)
    const nCat = resolve(nDetails, cat)
    let nCatExists = false
    try { nCatExists = statSync(nCat).isDirectory() } catch {}
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
  const goldenDir = process.argv[2]
  const newDir = process.argv[3]
  if (!goldenDir || !newDir) {
    console.error("Usage: bun run scripts/diff-index.ts <golden-dir> <new-dir>")
    process.exit(1)
  }
  console.log(`Comparing ${goldenDir} vs ${newDir}`)
  console.log()
  const indexDiffs = compareIndex(goldenDir, newDir)
  const detailDiffs = compareDetail(goldenDir, newDir)
  const total = indexDiffs + detailDiffs
  console.log()
  if (total === 0) {
    console.log("OK  no differences")
    process.exit(0)
  }
  console.log(`${total} difference(s) total`)
  process.exit(0)  // diff is informational, not an error
}

main()
