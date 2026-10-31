/**
 * Ship a pipeline change without upstream drift, in one command.
 *
 * Builds the catalog twice from the same on-disk mirror (`data/raw/`): once
 * from `<base-ref>` (default HEAD) in a throwaway git worktree, once from the
 * working tree as it is now, committed or not. Then applies only the
 * base→fixed delta onto the current catalog (`data:patch`) and stamps it.
 *
 * Usage:
 *   bun run data:ab [base-ref] [--verbose]
 *
 * Snapshots land in `data/ab/{base,fixed}` (gitignored); the fixed build
 * writes there via CATALOG_OUT_DIR, so the live catalog is only touched by
 * the patch.
 * `data/curated/wiki-image-urls.json`, which `build:items` rewrites, is
 * restored afterwards.
 */

import { spawnSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const AB = resolve(ROOT, "data/ab")
const WT = resolve(AB, "wt")
const IMAGE_CACHE = resolve(ROOT, "data/curated/wiki-image-urls.json")

const args = process.argv.slice(2)
const verbose = args.includes("--verbose")
const baseRef = args.find((a) => !a.startsWith("--")) ?? "HEAD"

function run(cmd: string, cmdArgs: string[], cwd = ROOT, outDir?: string) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}  (in ${cwd})`)
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: "inherit",
    env: outDir ? { ...process.env, CATALOG_OUT_DIR: outDir } : process.env,
  })
  if (r.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(" ")} failed`)
}

if (!existsSync(resolve(ROOT, "data/raw"))) {
  throw new Error("data/raw/ is missing: run `bun run data:sync` first")
}

rmSync(AB, { recursive: true, force: true })
spawnSync("git", ["worktree", "prune"], { cwd: ROOT })
const imageCache = readFileSync(IMAGE_CACHE)

try {
  // Base: the ref's code and dependencies, our mirror.
  run("git", ["worktree", "add", "--detach", WT, baseRef])
  cpSync(resolve(ROOT, "data/raw"), resolve(WT, "data/raw"), {
    recursive: true,
  })
  run("bun", ["install", "--frozen-lockfile"], WT)
  // No CATALOG_OUT_DIR here: an older ref's build may not read it.
  run("bun", ["run", "build:items"], WT)
  cpSync(resolve(WT, "apps/web/public/data"), resolve(AB, "base"), {
    recursive: true,
  })
  // Fixed: the working tree as it is.
  run("bun", ["run", "build:items"], ROOT, resolve(AB, "fixed"))
} finally {
  writeFileSync(IMAGE_CACHE, imageCache)
  spawnSync("git", ["worktree", "remove", "--force", WT], { cwd: ROOT })
}

run("bun", [
  "run",
  "scripts/patch-catalog.ts",
  resolve(AB, "base"),
  resolve(AB, "fixed"),
  ...(verbose ? ["--verbose"] : []),
])
run("bun", ["run", "scripts/stamp-data.ts"])
console.log(
  "\nNext: check that Changed fields above lists only your change, then run" +
    "\n  bun --filter=arsenyx-web run test parsed-catalog --update" +
    "\nif mods or arcanes changed, and `sync:images` if `check:images` fails.",
)
