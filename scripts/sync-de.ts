/**
 * Sync DE PublicExport into `data/raw/de/`.
 *
 * 1. Download `index_en.txt.lzma`, LZMA-decompress to get the index text.
 * 2. The index lists `<name>!<hash>` lines, one per `Export*.json` blob.
 * 3. For each entry: fetch `/PublicExport/Manifest/<name>!<hash>` — these
 *    are served as plain JSON, not LZMA. Sanitize stray NUL bytes (DE
 *    occasionally embeds 0x00 inside string values), validate as JSON, write
 *    pretty-printed to disk.
 * 4. Write `data/PINS.json` with the index hash + per-entry pins (under
 *    `de.` key) — merges with any existing wiki section.
 *
 * URL pattern: DE serves each blob at
 * `https://content.warframe.com/PublicExport/Manifest/<entry>` where
 * `<entry>` is the full `name!hash` index line.
 *
 * Network-only. The build never calls this; it reads from the on-disk mirror.
 * Run via `bun run scripts/sync-de.ts` or as part of `bun run data:sync`.
 */

import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { basename, resolve } from "node:path"

import { fetchBytes, fetchText } from "./build/http"
import { lzmaDecompressText } from "./build/lzma"

const INDEX_URL = "https://content.warframe.com/PublicExport/index_en.txt.lzma"
const BLOB_URL = (entry: string) =>
  `https://content.warframe.com/PublicExport/Manifest/${entry}`

const REPO_ROOT = resolve(import.meta.dirname, "..")
const OUT_DIR = resolve(REPO_ROOT, "data/raw/de")
const PINS_PATH = resolve(REPO_ROOT, "data/PINS.json")

interface PinEntry {
  name: string
  hash: string
  /** SHA-256 of the *decoded* JSON text we wrote to disk. Lets us detect
   *  upstream content changes even when DE re-uploads with a new hash but
   *  identical contents. */
  sha256: string
  bytes: number
}

async function main() {
  console.log(`Fetching DE PublicExport index...`)
  const indexBytes = await fetchBytes(INDEX_URL)
  const indexText = await lzmaDecompressText(indexBytes)

  const entries = indexText
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const idx = line.indexOf("!")
      if (idx < 0) throw new Error(`Malformed index line: ${line}`)
      return {
        entry: line,
        name: line.slice(0, idx),
        hash: line.slice(idx + 1),
      }
    })

  console.log(`Index has ${entries.length} entries. Mirroring to ${OUT_DIR}...`)
  await mkdir(OUT_DIR, { recursive: true })

  const pinEntries: PinEntry[] = []
  for (const { entry, name, hash } of entries) {
    process.stdout.write(`  ${name}... `)
    // Blobs at /Manifest/ are plain JSON, not LZMA-compressed. Only the index
    // itself uses LZMA.
    const raw = await fetchText(BLOB_URL(entry))
    // DE's exports occasionally contain literal NUL bytes inside string values
    // -- strip them so JSON.parse doesn't choke and so the file diffs cleanly
    // when DE re-uploads with cosmetic-only changes.
    const clean = raw.replaceAll("\x00", "")
    // Round-trip through JSON.parse / JSON.stringify so we:
    //   - validate the payload is well-formed JSON before committing
    //   - normalize whitespace (DE's output is minified; pretty-print so git
    //     diffs are line-by-line readable)
    const parsed = JSON.parse(clean)
    const pretty = JSON.stringify(parsed, null, 2) + "\n"
    // The index name is trusted (DE-controlled), but make the trust boundary
    // explicit: a `name` with path separators would escape OUT_DIR.
    if (basename(name) !== name) {
      throw new Error(`Unexpected path separator in index entry name: ${name}`)
    }
    await writeFile(resolve(OUT_DIR, name), pretty, "utf8")
    const sha = createHash("sha256").update(pretty).digest("hex")
    pinEntries.push({ name, hash, sha256: sha, bytes: pretty.length })
    process.stdout.write(`${(pretty.length / 1024).toFixed(1)} KB\n`)
  }

  // Merge with any existing wiki section so re-running this script doesn't
  // wipe the wiki half.
  let existing: Record<string, unknown> = {}
  try {
    const txt = await Bun.file(PINS_PATH).text()
    existing = JSON.parse(txt)
  } catch {
    // First run, no PINS.json yet.
  }
  const merged = {
    ...existing,
    de: {
      indexHash: createHash("sha256").update(indexText).digest("hex"),
      fetchedAt: new Date().toISOString(),
      entries: pinEntries,
    },
  }
  await writeFile(PINS_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8")
  console.log(`\n  OK  ${entries.length} files -> data/raw/de/`)
  console.log(
    `  OK  data/PINS.json (de.indexHash=${merged.de.indexHash.slice(0, 12)}...)`,
  )
}

// Force exit on success. The `lzma` package (used to decode the PublicExport
// index) leaves a dangling worker/timer handle that keeps the event loop alive
// indefinitely, so the process never exits on its own once main() resolves —
// which hangs `data:sync` (`&&` never advances) and `bump-data` (spawnSync
// never returns) right after the DE step. All disk writes are awaited inside
// main(), so exiting here is safe.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
