/**
 * Phase 4 demonstration: merge DE + wiki + curated into the new
 * three-field weapon model, end-to-end.
 *
 * Not a replacement for `scripts/build-items-index.ts` yet — this script
 * proves the merge produces well-formed records for every DE weapon and
 * surfaces concrete diagnostics (unmatched names, unknown classes, pool
 * coverage). Phase 4b (full pipeline replacement) plugs this output into
 * the items-index emit path.
 *
 * Output:
 *   data/golden-v2/weapons.json   — array of MergedWeapon
 *   data/golden-v2/_report.json   — counts + diagnostics
 *
 * Run via `bun run scripts/build-weapons-v2.ts`.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { readCurated } from "./build/read-curated"
import { readDeWeapons } from "./build/read-de"
import {
  mergeWeapon,
  validateCuratedAgainstKnown,
  type MergedWeapon,
} from "./build/merge-weapons"
import { readWikiModule } from "./build/read-wiki"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const WIKI_DIR = resolve(REPO_ROOT, "data/raw/wiki")
const OUT_DIR = resolve(REPO_ROOT, "data/golden-v2")

const WIKI_WEAPON_SUBPAGES = [
  "Weapons_data_primary.lua",
  "Weapons_data_secondary.lua",
  "Weapons_data_melee.lua",
  "Weapons_data_archwing.lua",
  "Weapons_data_companion.lua",
  "Weapons_data_railjack.lua",
  "Weapons_data_modular.lua",
  "Weapons_data_misc.lua",
]

async function main() {
  const curated = readCurated()
  validateCuratedAgainstKnown(curated)

  console.log("Reading wiki weapon subpages...")
  const wikiByName = new Map<string, Record<string, unknown>>()
  for (const f of WIKI_WEAPON_SUBPAGES) {
    const m = readWikiModule(resolve(WIKI_DIR, f))
    let added = 0
    for (const [name, entry] of Object.entries(m)) {
      if (typeof entry === "object" && entry !== null) {
        wikiByName.set(name, entry as Record<string, unknown>)
        added++
      }
    }
    console.log(`  ${f.padEnd(38)} ${added} entries`)
  }
  console.log(`  ${wikiByName.size} unique weapon names across subpages`)
  console.log()

  console.log("Reading DE weapons...")
  const deWeapons = readDeWeapons()
  console.log(`  ${deWeapons.length} DE weapon records`)
  console.log()

  const unmatched = new Set<string>()
  const merged: MergedWeapon[] = []
  const errors: { name: string; error: string }[] = []
  for (const de of deWeapons) {
    try {
      merged.push(mergeWeapon(de, { curated, wikiByName, unmatched }))
    } catch (err) {
      errors.push({
        name: de.name,
        error: (err as Error).message,
      })
    }
  }

  // Bucket diagnostics
  const byCategory = new Map<string, number>()
  const byClass = new Map<string | null, number>()
  const noDisplayClass: string[] = []
  for (const w of merged) {
    byCategory.set(w.productCategory, (byCategory.get(w.productCategory) ?? 0) + 1)
    byClass.set(w.displayClass, (byClass.get(w.displayClass) ?? 0) + 1)
    if (w.displayClass === null) noDisplayClass.push(w.name)
  }

  const report = {
    counts: {
      deWeapons: deWeapons.length,
      merged: merged.length,
      errors: errors.length,
      unmatched: unmatched.size,
      noDisplayClass: noDisplayClass.length,
    },
    byProductCategory: Object.fromEntries(byCategory),
    byDisplayClass: Object.fromEntries(byClass),
    errors: errors.slice(0, 20),
    unmatchedSample: [...unmatched].slice(0, 30),
    noDisplayClassSample: noDisplayClass.slice(0, 30),
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(
    resolve(OUT_DIR, "weapons.json"),
    JSON.stringify(merged, null, 2) + "\n",
    "utf8",
  )
  await writeFile(
    resolve(OUT_DIR, "_report.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  )

  console.log("Merge complete:")
  console.log(`  merged:            ${merged.length}`)
  console.log(`  errors:            ${errors.length}`)
  console.log(`  unmatched (no wiki): ${unmatched.size}`)
  console.log(`  no displayClass:   ${noDisplayClass.length}`)
  console.log()
  console.log("By DE productCategory:")
  for (const [k, v] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(18)} ${v}`)
  }
  console.log()
  if (errors.length > 0) {
    console.log(`First ${Math.min(10, errors.length)} errors:`)
    for (const e of errors.slice(0, 10)) {
      console.log(`  ${e.name}: ${e.error.split("\n")[0].slice(0, 140)}`)
    }
  } else {
    console.log("No errors. Sample Coda Bubonico merge:")
    const bub = merged.find((m) => m.name === "Coda Bubonico")
    console.log(JSON.stringify(bub, null, 2))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
