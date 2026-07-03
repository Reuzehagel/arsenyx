/**
 * CI guard: every image URL in the committed catalog under
 * `apps/web/public/data/` must point at our own CDN (`img.arsenyx.com`) or a
 * local `/img/...` path — never at the upstream `content.warframe.com` /
 * `wiki.warframe.com` hosts.
 *
 * `build:items` emits upstream URLs; `sync:images` mirrors the bytes into R2
 * and rewrites the catalog to our CDN. This check fails the build if a
 * catalog where that rewrite was skipped gets committed, so a hotlink — which
 * depends on DE/wiki uptime and rots whenever they re-export — can never
 * reach production. Run `bun run sync:images` to fix.
 */

import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

import { findJsonFiles, sourceUrlRe } from "./build/image-hosts"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const DATA_DIR = resolve(REPO_ROOT, "apps/web/public/data")
const UPSTREAM_RE = sourceUrlRe()

let offenders = 0
let totalUrls = 0
for (const f of findJsonFiles(DATA_DIR)) {
  const hits = new Set(readFileSync(f, "utf8").match(UPSTREAM_RE) ?? [])
  if (hits.size > 0) {
    offenders++
    totalUrls += hits.size
    console.error(
      `✗ ${relative(REPO_ROOT, f)} — ${hits.size} upstream URL(s), e.g. ${[...hits][0]}`,
    )
  }
}

if (offenders > 0) {
  console.error(
    `\n${offenders} catalog file(s) still hotlink upstream (${totalUrls} URL(s) total).\n` +
      `Run \`bun run sync:images\` to mirror them into R2 and rewrite the catalog.`,
  )
  process.exit(1)
}

console.log("✓ catalog images all point at our CDN")
