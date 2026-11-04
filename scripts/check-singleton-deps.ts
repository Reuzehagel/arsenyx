/**
 * Install guard: every CodeMirror / Lezer package apps/web reaches must share
 * ONE copy of each package in that family. Two copies (e.g. @codemirror/state
 * 6.6.0 next to 6.7.6) crash the guide editor with "Unrecognized extension
 * value in extension set". `bun install --frozen-lockfile` can leave such a
 * stale store link behind after a dependency bump even though bun.lock is
 * clean; `bun install --force` relinks it. Runs from `just deps`.
 *
 * Walks the dependency graph from apps/web (orphaned versions in the bun store
 * are harmless and ignored).
 */

import { existsSync, readFileSync, realpathSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const WEB = resolve(import.meta.dirname, "../apps/web")
const FAMILY = /^@(codemirror|lezer)\//

/** Node-style lookup: nearest `node_modules/<dep>` walking up from `from`. */
function locate(dep: string, from: string): string | undefined {
  for (let d = from; ; d = dirname(d)) {
    const candidate = join(d, "node_modules", dep)
    if (existsSync(candidate)) return realpathSync(candidate)
    if (dirname(d) === d) return undefined
  }
}

function familyDeps(pkgDir: string): string[] {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"))
  return Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }).filter(
    (d) => FAMILY.test(d),
  )
}

const copies = new Map<string, Set<string>>()
const seen = new Set<string>()
const queue = [WEB]
while (queue.length > 0) {
  const dir = queue.pop()!
  for (const dep of familyDeps(dir)) {
    const real = locate(dep, dir)
    if (!real) continue
    if (!copies.has(dep)) copies.set(dep, new Set())
    copies.get(dep)!.add(real)
    if (!seen.has(real)) {
      seen.add(real)
      queue.push(real)
    }
  }
}

const dupes = [...copies].filter(([, dirs]) => dirs.size > 1)
if (dupes.length > 0) {
  for (const [dep, dirs] of dupes) {
    console.error(`✗ ${dep} resolves to ${dirs.size} copies:`)
    for (const d of dirs) console.error(`    ${d}`)
  }
  console.error("\nStale install. Run `bun install --force`.")
  process.exit(1)
}
