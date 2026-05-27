/**
 * Phase 4 demonstration: merge DE mods into our normalized shape,
 * end-to-end. Companion to `build-weapons-v2.ts`.
 *
 * Output:
 *   data/golden-v2/mods.json       — array of MergedMod
 *   data/golden-v2/mods-report.json — filter counts + type/compatName histograms
 */

import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { mergeMods } from "./build/merge-mods"
import { readDeUpgrades } from "./build/read-de"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const OUT_DIR = resolve(REPO_ROOT, "data/golden-v2")

async function main() {
  const upgrades = readDeUpgrades()
  console.log(`DE upgrades: ${upgrades.ExportUpgrades?.length ?? 0} entries`)
  console.log(`DE modsets:  ${upgrades.ExportModSet?.length ?? 0} entries`)
  console.log()

  const result = mergeMods(
    upgrades.ExportUpgrades ?? [],
    upgrades.ExportModSet ?? [],
  )

  console.log("Filter counts:")
  for (const [k, v] of Object.entries(result.counts)) {
    console.log(`  ${k.padEnd(18)} ${v}`)
  }
  console.log()

  // Build distribution by compatName + polarity
  const byCompat = new Map<string, number>()
  const byPolarity = new Map<string, number>()
  const byType = new Map<string, number>()
  for (const m of result.mods) {
    byCompat.set(m.compatName || "(none)", (byCompat.get(m.compatName || "(none)") ?? 0) + 1)
    byPolarity.set(m.polarity, (byPolarity.get(m.polarity) ?? 0) + 1)
    byType.set(m.type || "(none)", (byType.get(m.type || "(none)") ?? 0) + 1)
  }
  console.log("By type:")
  for (const [k, v] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(18)} ${v}`)
  }
  console.log()
  console.log("By polarity:")
  for (const [k, v] of [...byPolarity.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`)
  }
  console.log()
  console.log("Top 15 compatNames:")
  for (const [k, v] of [...byCompat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${k.padEnd(20)} ${v}`)
  }
  console.log()

  // Sample Serration to verify shape
  const ser = result.mods.find((m) => m.name === "Serration")
  if (ser) {
    console.log("Sample Serration:")
    console.log(JSON.stringify(ser, null, 2))
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(
    resolve(OUT_DIR, "mods.json"),
    JSON.stringify(result.mods, null, 2) + "\n",
    "utf8",
  )
  await writeFile(
    resolve(OUT_DIR, "mods-report.json"),
    JSON.stringify(
      {
        counts: result.counts,
        byType: Object.fromEntries(byType),
        byPolarity: Object.fromEntries(byPolarity),
        byCompatName: Object.fromEntries(byCompat),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  )
  console.log(`\nWrote ${result.mods.length} mods to data/golden-v2/mods.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
