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
 *
 * Watchdog: every step runs under a wall-clock budget. If one blows past it
 * the child is force-killed and we abort loudly instead of hanging forever.
 * This is a backstop for hang vectors like a dangling worker/timer handle
 * (the `lzma` package once kept sync-de alive indefinitely) or a stalled
 * network connection — the budgets are generous, so tripping one means
 * "something is wedged", not "this was just slow".
 */

import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dirname, "..")

// Generous backstop; a healthy step finishes in seconds. sync-images can
// legitimately run long when uploading a freshly-populated bucket, so it
// gets a bigger budget than the rest.
const DEFAULT_TIMEOUT_MS = 300_000

const STEPS: ReadonlyArray<{
  label: string
  script: string
  args?: string[]
  timeoutMs?: number
}> = [
  { label: "Sync DE PublicExport", script: "scripts/sync-de.ts" },
  { label: "Sync wiki Lua modules", script: "scripts/sync-wiki.ts" },
  {
    label: "Build items-index + per-item details",
    script: "scripts/build-items-index.ts",
  },
  {
    label: "Mirror images to R2 + rewrite catalog",
    script: "scripts/sync-images.ts",
    args: ["--skip-if-no-creds"],
    timeoutMs: 900_000,
  },
]

for (const step of STEPS) {
  console.log(`\n=== ${step.label} ===`)
  const timeoutMs = step.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const r = spawnSync("bun", ["run", step.script, ...(step.args ?? [])], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  })
  // spawnSync kills the child and sets error.code ETIMEDOUT (and a kill
  // signal, with no exit status) when a step exceeds its budget.
  const timedOut =
    (r.error as { code?: string } | null | undefined)?.code === "ETIMEDOUT" ||
    (r.status === null && r.signal != null)
  if (timedOut) {
    console.error(
      `✗ ${step.label} exceeded ${Math.round(timeoutMs / 1000)}s and was ` +
        `killed — the step is hanging (likely a dangling handle keeping the ` +
        `event loop alive, or a stalled network connection). Aborting.`,
    )
    process.exit(1)
  }
  if (r.error) {
    console.error(`✗ ${step.label} could not run:`, r.error.message)
    process.exit(1)
  }
  if (r.status !== 0) {
    console.error(`✗ ${step.label} failed (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}

console.log("\n✓ data bump complete")
