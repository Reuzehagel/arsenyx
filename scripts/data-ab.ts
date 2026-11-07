/**
 * Ship a pipeline change without upstream drift, in one command.
 *
 * Builds the catalog twice from the same on-disk mirror (`data/raw/`): once
 * from `<base-ref>` (default HEAD) in a throwaway git worktree, once from the
 * working tree as it is now, committed or not. Then applies only the
 * base→fixed delta onto the current catalog (`data:patch`) and stamps it.
 *
 * Usage:
 *   bun run data:ab [base-ref] [--verbose] [--check] [--raw <dir>]
 *
 * --check  verify a refactor instead of shipping it: diff the two builds
 *          (meta.json's generatedAt ignored), exit 1 on any difference, and
 *          leave the live catalog alone.
 * --raw    read the mirror from <dir> instead of data/raw/ (e.g. the main
 *          checkout's, from a worktree that has none).
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

import {
  CATALOG_DIR,
  WIKI_IMAGE_CACHE as IMAGE_CACHE,
  REPO_ROOT as ROOT,
} from "./build/paths"
import { diffCatalogDirs } from "./lib/catalog-dirs"

const AB = resolve(ROOT, "data/ab")
const WT = resolve(AB, "wt")

const args = process.argv.slice(2)
const verbose = args.includes("--verbose")
const check = args.includes("--check")
const rawFlag = args.indexOf("--raw")
const rawArg = rawFlag >= 0 ? args[rawFlag + 1] : undefined
const baseRef =
  args.find((a, i) => !a.startsWith("--") && i !== rawFlag + 1) ?? "HEAD"
const RAW = resolve(ROOT, "data/raw")
const rawSrc = rawArg ? resolve(rawArg) : RAW

function run(cmd: string, cmdArgs: string[], cwd = ROOT, outDir?: string) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}  (in ${cwd})`)
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    stdio: "inherit",
    env: outDir ? { ...process.env, CATALOG_OUT_DIR: outDir } : process.env,
  })
  if (r.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(" ")} failed`)
}

if (!existsSync(rawSrc)) {
  throw new Error(
    `${rawSrc} is missing: run \`bun run data:sync\` first, or pass --raw <dir>`,
  )
}
// The working-tree build reads data/raw/; borrow --raw's mirror for it.
const borrowedRaw = rawSrc !== RAW && !existsSync(RAW)
if (borrowedRaw) cpSync(rawSrc, RAW, { recursive: true })

rmSync(AB, { recursive: true, force: true })
spawnSync("git", ["worktree", "prune"], { cwd: ROOT })
const imageCache = readFileSync(IMAGE_CACHE)

try {
  // Base: the ref's code and dependencies, our mirror.
  run("git", ["worktree", "add", "--detach", WT, baseRef])
  cpSync(rawSrc, resolve(WT, "data/raw"), {
    recursive: true,
  })
  run("bun", ["install", "--frozen-lockfile"], WT)
  // No CATALOG_OUT_DIR here: an older ref's build may not read it.
  run("bun", ["run", "build:items"], WT)
  cpSync(resolve(WT, CATALOG_DIR), resolve(AB, "base"), {
    recursive: true,
  })
  // Fixed: the working tree as it is.
  run("bun", ["run", "build:items"], ROOT, resolve(AB, "fixed"))
} finally {
  writeFileSync(IMAGE_CACHE, imageCache)
  spawnSync("git", ["worktree", "remove", "--force", WT], { cwd: ROOT })
  if (borrowedRaw) rmSync(RAW, { recursive: true, force: true })
}

if (check) {
  const diff = diffCatalogDirs(resolve(AB, "base"), resolve(AB, "fixed"))
  if (diff.length > 0) {
    console.error(`\n✗ catalog differs from ${baseRef}:\n${diff.join("\n")}`)
    process.exit(1)
  }
  console.log(`\n✓ catalog is identical to ${baseRef}'s build`)
  process.exit(0)
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
