/**
 * One-shot data refresh: sync upstream sources + rebuild the static
 * catalog. Invoked by the weekly GitHub Actions workflow and locally
 * via `bun run data:bump`.
 *
 * Steps:
 *  1. `sync-de.ts`      → mirror DE PublicExport JSON blobs.
 *  2. `sync-wiki.ts`    → mirror wiki Lua modules.
 *  3. `build-items-index.ts` → emit apps/web/public/data/*.
 *  4. `sync-images.ts`  → mirror emitted image URLs into R2 + rewrite the
 *     catalog to point at our CDN. Passed `--skip-if-no-creds`: a checkout
 *     without R2 creds (incl. the weekly CI cron, which has no R2 secrets)
 *     skips this and leaves upstream URLs in place. CI's `check:images`
 *     guard then blocks merging such a catalog, so a human runs
 *     `sync:images` locally on the data PR before it lands.
 *
 * Exits non-zero on the first step that fails. Each sub-step prints its
 * own progress; we just chain them in order.
 */

import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dirname, "..")

const STEPS: ReadonlyArray<{ label: string; script: string; args?: string[] }> = [
  { label: "Sync DE PublicExport", script: "scripts/sync-de.ts" },
  { label: "Sync wiki Lua modules", script: "scripts/sync-wiki.ts" },
  { label: "Build items-index + per-item details", script: "scripts/build-items-index.ts" },
  {
    label: "Mirror images to R2 + rewrite catalog",
    script: "scripts/sync-images.ts",
    args: ["--skip-if-no-creds"],
  },
]

for (const step of STEPS) {
  console.log(`\n=== ${step.label} ===`)
  const r = spawnSync("bun", ["run", step.script, ...(step.args ?? [])], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  })
  if (r.status !== 0) {
    console.error(`✗ ${step.label} failed (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}

console.log("\n✓ data bump complete")
