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
 *
 * Also lists unshipped work, which it never deletes: worktrees with
 * uncommitted changes, and branches whose changes aren't on origin/main
 * (squash-aware, so a squash-merged branch doesn't show).
 */

import { readdirSync, renameSync, rmSync } from "node:fs"
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

// Unshipped work: listed so it isn't forgotten, never pruned.
const tryGit = (...args: string[]) => {
  try {
    return git(...args)
  } catch {
    return "" // e.g. a registered worktree whose folder is gone
  }
}
const dirty = [...registered].flatMap((w) => {
  const n = tryGit("-C", w, "status", "--porcelain").split("\n").filter(Boolean)
  return n.length ? [`${n.length} files\t${w}`] : []
})
const unmerged = git("for-each-ref", "--format=%(refname:short)", "refs/heads")
  .split("\n")
  .filter(Boolean)
  .flatMap((b) => {
    // Squash the branch into one commit on its merge base: `git cherry` then
    // prints "-" when main already holds that patch (a squash merge).
    const base = tryGit("merge-base", "origin/main", b).trim()
    const n = Number(tryGit("rev-list", "--count", `${base}..${b}`).trim())
    if (!base || !n) return []
    const squashed = tryGit(
      "commit-tree",
      `${b}^{tree}`,
      "-p",
      base,
      "-m",
      "squash",
    ).trim()
    const merged = tryGit("cherry", "origin/main", squashed).startsWith("-")
    return merged ? [] : [`${n} commits\t${b}`]
  })
console.log(`Worktrees with uncommitted changes (${dirty.length}):`)
for (const d of dirty) console.log(`  ${d}`)
console.log(`Branches not merged into origin/main (${unmerged.length}):`)
for (const b of unmerged) console.log(`  ${b}`)
console.log()

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
    // Rename first: it fails whole on a locked folder, where a bare rmSync
    // would delete everything it can and leave a half-gutted tree.
    const doomed = `${d}.prune-${Date.now()}`
    renameSync(d, doomed)
    rmSync(doomed, { recursive: true, force: true })
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
