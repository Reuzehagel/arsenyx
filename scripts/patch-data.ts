/**
 * Land a build-pipeline fix on ONE catalog field without a full data refresh.
 *
 *   bun run build:items
 *   bun run data:patch mods-all.json --field compatItems [--field …]
 *
 * A local `build:items` regenerates every file under `apps/web/public/data/`
 * from the on-disk `data/raw` mirror, which usually lags the committed catalog
 * (and emits upstream image URLs until `sync:images` runs), so committing the
 * rebuild would regress unrelated data. This rewrites `<file>` as its HEAD
 * version with only the named fields copied over from the fresh build,
 * matched by `uniqueName`, then prints the commands to discard the rest of the
 * rebuild and stamp `generatedAt`.
 */

import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

type Row = Record<string, unknown>

const REPO_ROOT = resolve(import.meta.dirname, "..")
const DATA = "apps/web/public/data"

const args = process.argv.slice(2)
const file = args.find(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--field",
)
const fields = args.flatMap((a, i) => (args[i - 1] === "--field" ? [a] : []))
if (!file || fields.length === 0) {
  console.error(
    "usage: bun run data:patch <file under public/data> --field <name> [--field …]",
  )
  process.exit(1)
}

const rel = `${DATA}/${file}`
const head = spawnSync("git", ["show", `HEAD:${rel}`], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  maxBuffer: 256 * 1024 * 1024,
})
if (head.status !== 0) {
  console.error(`✗ data:patch — ${rel} not in HEAD: ${head.stderr.trim()}`)
  process.exit(1)
}

const raw = head.stdout
const base = JSON.parse(raw) as Row[]
const fresh = JSON.parse(readFileSync(resolve(REPO_ROOT, rel), "utf8")) as Row[]
if (!Array.isArray(base) || !Array.isArray(fresh)) {
  console.error(`✗ data:patch — ${file} is not an array of records`)
  process.exit(1)
}

// Re-serialize in whatever shape the committed file uses, and refuse if
// neither reproduces it byte-for-byte — otherwise the patch would smuggle in
// a whole-file whitespace diff.
const indent = JSON.stringify(base) === raw ? undefined : 2
if (indent === 2 && JSON.stringify(base, null, 2) !== raw) {
  console.error(
    `✗ data:patch — can't reproduce ${file}'s serialization; aborting`,
  )
  process.exit(1)
}

const freshByName = new Map(fresh.map((r) => [r["uniqueName"], r]))
const changed: string[] = []
for (const row of base) {
  const next = freshByName.get(row["uniqueName"])
  if (!next) continue
  let touched = false
  for (const f of fields) {
    if (JSON.stringify(row[f]) === JSON.stringify(next[f])) continue
    if (next[f] === undefined) delete row[f]
    else row[f] = next[f]
    touched = true
  }
  if (touched) changed.push(String(row["name"] ?? row["uniqueName"]))
}

writeFileSync(resolve(REPO_ROOT, rel), JSON.stringify(base, null, indent))

const added = fresh.length - base.length
console.log(
  `✓ data:patch — ${changed.length} record(s) changed in ${file} (${fields.join(", ")})`,
)
for (const name of changed.slice(0, 30)) console.log(`  · ${name}`)
if (changed.length > 30) console.log(`  … and ${changed.length - 30} more`)
if (added !== 0) {
  console.log(
    `  note: the build has ${added > 0 ? "+" : ""}${added} records vs HEAD; added/removed rows are not patched`,
  )
}
console.log(`
Next, discard the rest of the rebuild and stamp the data version:
  git restore -- ${DATA} data/curated ':!${rel}'
  git clean -fd -- ${DATA}
  bun run data:stamp`)
