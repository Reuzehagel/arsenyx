/**
 * Print a markdown summary of how the catalog (apps/web/public/data) in the
 * working tree differs from a git ref. The weekly data cron puts this in the
 * auto-PR body; locally it's a quick read of what a rebuild moved.
 *
 * Usage:
 *   bun run data:diff [base-ref]   # default HEAD; e.g. origin/main on a data branch
 */

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { summarizeCatalogDiff, type FileChange } from "./build/catalog-diff"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const DATA = "apps/web/public/data"
const base = process.argv[2] ?? "HEAD"

function git(args: string[]): string {
  const r = spawnSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 1 << 30,
  })
  if (r.status !== 0) {
    console.error(`✗ data:diff — git ${args.join(" ")} failed:\n${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}

const lines = (s: string) => s.split("\n").filter((f) => f.endsWith(".json"))
const paths = new Set([
  ...lines(git(["diff", "--name-only", base, "--", DATA])),
  ...lines(git(["ls-files", "--others", "--exclude-standard", "--", DATA])),
])

const changes: FileChange[] = [...paths].map((p) => {
  const inBase =
    spawnSync("git", ["cat-file", "-e", `${base}:${p}`], { cwd: REPO_ROOT })
      .status === 0
  const abs = resolve(REPO_ROOT, p)
  return {
    path: p.slice(DATA.length + 1),
    before: inBase ? JSON.parse(git(["show", `${base}:${p}`])) : undefined,
    after: existsSync(abs) ? JSON.parse(readFileSync(abs, "utf8")) : undefined,
  }
})

console.log(summarizeCatalogDiff(changes))
