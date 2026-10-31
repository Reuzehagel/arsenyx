/**
 * CI guard: a PR that changes the web app must add a changelog entry
 * (`apps/web/src/data/changelog.ts`), or carry the `no-changelog` label for
 * changes players can't see (refactors, tests, tooling).
 *
 * Compares against `$CHANGELOG_BASE` (default `origin/main`). The workflow
 * sets `SKIP_CHANGELOG=true` when the label is present. A missing base ref
 * skips locally and fails in CI, like check:data-version.
 */

import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const explicitBase = process.env.CHANGELOG_BASE
const BASE = explicitBase ?? "origin/main"
const CHANGELOG = "apps/web/src/data/changelog.ts"

if (process.env.SKIP_CHANGELOG === "true") {
  console.log("✓ check:changelog — skipped by the no-changelog label.")
  process.exit(0)
}

function git(args: string[]) {
  return spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" })
}

if (git(["rev-parse", "--verify", "--quiet", BASE]).status !== 0) {
  if (explicitBase) {
    console.error(
      `✗ check:changelog — base ref '${BASE}' not found. Ensure the ref is ` +
        `fetched (e.g. actions/checkout fetch-depth: 0).`,
    )
    process.exit(1)
  }
  console.log(`check:changelog — base ref '${BASE}' not found; skipping.`)
  process.exit(0)
}

// Three-dot: only what this branch changed, not what main gained since.
const changed = git(["diff", "--name-only", `${BASE}...HEAD`])
  .stdout.split("\n")
  .filter(Boolean)

const appChanges = changed.filter(
  (f) =>
    (f.startsWith("apps/web/src/") || f.startsWith("apps/web/worker/")) &&
    !/\.test\.tsx?$/.test(f) &&
    !f.endsWith(".snap.txt") &&
    f !== CHANGELOG,
)

if (appChanges.length === 0) {
  console.log("✓ check:changelog — no web app changes to gate.")
  process.exit(0)
}

if (changed.includes(CHANGELOG)) {
  console.log("✓ check:changelog — changelog entry included.")
  process.exit(0)
}

console.error(
  `✗ check:changelog — this PR changes the web app but not ${CHANGELOG}:\n` +
    appChanges.map((f) => `    ${f}`).join("\n") +
    `\n  Add an entry at the top (plain, player-facing wording), or label the ` +
    `PR no-changelog if players can't see the change.`,
)
process.exit(1)
