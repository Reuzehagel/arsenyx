/**
 * Clean up after merged PRs. `gh pr merge --delete-branch` deletes the remote
 * branch but on Windows often can't remove the worktree folder (file locks),
 * leaving it unregistered on disk, and keeps the local branch.
 *
 *   bun scripts/prune-worktrees.ts        list what would go
 *   bun scripts/prune-worktrees.ts --go   delete it
 *
 * Removes folders under .claude/worktrees/ that `git worktree list` no longer
 * knows, and local branches whose upstream is gone. `git branch -D` prints each
 * branch's sha, so a deleted branch stays recoverable from the reflog.
 */

import { readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"

const REPO = resolve(import.meta.dirname, "..")
const WORKTREES = resolve(REPO, ".claude/worktrees")
const go = process.argv.includes("--go")

const git = (...args: string[]) => {
  const proc = Bun.spawnSync({ cmd: ["git", ...args], cwd: REPO })
  if (proc.exitCode !== 0)
    throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString()}`)
  return proc.stdout.toString()
}

const norm = (p: string) => resolve(p).toLowerCase()
const registered = new Set(
  git("worktree", "list", "--porcelain")
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => norm(l.slice("worktree ".length))),
)
let dirs: string[] = []
try {
  dirs = readdirSync(WORKTREES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => resolve(WORKTREES, d.name))
    .filter((d) => !registered.has(norm(d)))
} catch {} // no .claude/worktrees yet

// A gone branch still checked out in a worktree gets refused by `git branch -D`.
const branches = git(
  "for-each-ref",
  "--format=%(refname:short)\t%(upstream:track)",
  "refs/heads",
)
  .split("\n")
  .filter((l) => l.endsWith("\t[gone]"))
  .map((l) => l.split("\t")[0])

if (!dirs.length && !branches.length) {
  console.log("Nothing to prune.")
  process.exit(0)
}

console.log(`Orphan worktree folders (${dirs.length}):`)
for (const d of dirs) console.log(`  ${d}`)
console.log(`Branches whose upstream is gone (${branches.length}):`)
for (const b of branches) console.log(`  ${b}`)

if (!go) {
  console.log("\nDry run. Re-run with --go to delete.")
  process.exit(0)
}

let failed = 0
for (const d of dirs) {
  try {
    rmSync(d, { recursive: true, force: true })
  } catch (e) {
    failed++
    console.error(`Could not delete ${d} (still locked?): ${e}`)
  }
}
for (const b of branches) {
  try {
    process.stdout.write(git("branch", "-D", b))
  } catch (e) {
    failed++
    console.error(String(e))
  }
}
process.exit(failed ? 1 : 0)
