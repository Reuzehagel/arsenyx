/**
 * CI guard: both Workers' wrangler.toml must bundle and parse cleanly. Runs
 * `wrangler deploy --dry-run` (no auth, uploads nothing). Wrangler only WARNS
 * on an unknown config key and still exits 0 — a typo'd `[[ratelimits]]` block
 * would ship with its binding missing, and the rate-limit middleware fails open
 * — so a config warning fails this check too. apps/web needs `dist/` built first.
 */

import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dirname, "..")

let failed = false
for (const app of ["apps/api", "apps/web"]) {
  const res = Bun.spawnSync(
    [
      "bunx",
      "wrangler",
      "deploy",
      "--dry-run",
      "--outdir",
      mkdtempSync(join(tmpdir(), "wrangler-dry-")),
    ],
    { cwd: resolve(REPO_ROOT, app), env: { ...process.env, NO_COLOR: "1" } },
  )
  const stderr = res.stderr.toString()
  const configWarning = /Processing .*configuration/.test(stderr)
  if (res.exitCode !== 0 || configWarning) {
    failed = true
    console.error(`✗ ${app}: wrangler dry-run failed\n${stderr}`)
  } else {
    console.log(`✓ ${app}: wrangler config + bundle OK`)
  }
}

if (failed) process.exit(1)
