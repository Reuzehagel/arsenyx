/**
 * CI guard: if the committed catalog under `apps/web/public/data/` changed but
 * `meta.json`'s `generatedAt` did NOT, fail.
 *
 * The catalog is served `immutable, max-age=1yr` and cache-busted via
 * `?v=<generatedAt>` (vite.config.ts `dataVersion()`). `build:items` writes a
 * fresh `generatedAt` every run, so a full `data:refresh` is always safe and
 * the weekly cron never trips this. The footgun is a *hand-edit* to the catalog
 * (a quick data fix) that forgets to bump `generatedAt` — clients then keep the
 * stale bytes forever under the unchanged URL. Run `bun run data:stamp` to fix.
 *
 * Compares against `$DATA_VERSION_BASE` (default `origin/main`). If that ref
 * isn't reachable (shallow clone, fresh repo), it skips rather than fail
 * spuriously — CI fetches full history so the guard is live there.
 */

import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dirname, "..")
// An explicit base (CI sets DATA_VERSION_BASE) means the caller wants
// enforcement — a missing ref there is a setup error, not a reason to skip.
// The local default is a convenience, so skip gracefully if it's absent.
const explicitBase = process.env.DATA_VERSION_BASE
const BASE = explicitBase ?? "origin/main"
const DATA = "apps/web/public/data"

function git(args: string[]) {
  return spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" })
}

if (git(["rev-parse", "--verify", "--quiet", BASE]).status !== 0) {
  if (explicitBase) {
    console.error(
      `✗ check:data-version — base ref '${BASE}' (from DATA_VERSION_BASE) not ` +
        `found, so the guard can't run. Ensure the ref is fetched ` +
        `(e.g. actions/checkout fetch-depth: 0).`,
    )
    process.exit(1)
  }
  console.log(`check:data-version — base ref '${BASE}' not found; skipping.`)
  process.exit(0)
}

// Did any catalog file change, ignoring the two build-stamp files that move
// every run on their own (meta carries the version; _report is telemetry)?
const dataChanged =
  git([
    "diff",
    "--quiet",
    BASE,
    "--",
    DATA,
    `:(exclude)${DATA}/meta.json`,
    `:(exclude)${DATA}/_report.json`,
  ]).status !== 0

if (!dataChanged) {
  console.log("✓ check:data-version — no catalog changes to gate.")
  process.exit(0)
}

const baseShow = git(["show", `${BASE}:${DATA}/meta.json`])
const baseGen =
  baseShow.status === 0
    ? (JSON.parse(baseShow.stdout) as { generatedAt?: string }).generatedAt
    : undefined
const curGen = (
  JSON.parse(readFileSync(resolve(REPO_ROOT, DATA, "meta.json"), "utf8")) as {
    generatedAt?: string
  }
).generatedAt

if (baseGen === curGen) {
  console.error(
    `✗ check:data-version — ${DATA}/ changed but meta.json generatedAt is ` +
      `unchanged (${curGen}). The catalog is cached immutably under ` +
      `?v=<generatedAt>, so clients would never see this change. ` +
      `Run \`bun run data:stamp\`.`,
  )
  process.exit(1)
}

console.log(
  `✓ check:data-version — catalog change carries a fresh generatedAt ` +
    `(${baseGen} → ${curGen}).`,
)
