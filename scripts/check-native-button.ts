/**
 * CI guard: a shadcn `<Button>` that renders a Link or `<a>` must pass
 * `nativeButton={false}`. Without it Base UI logs a console error on every
 * render and announces the link as a button. Scans apps/web/src, skipping the
 * vendored components/ui.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

import { findNativeButtonOffenders } from "./build/native-button"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const SRC = resolve(REPO_ROOT, "apps/web/src")
const SKIP = resolve(SRC, "components/ui")

function* tsxFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (p !== SKIP) yield* tsxFiles(p)
    } else if (e.name.endsWith(".tsx")) yield p
  }
}

let offenders = 0
for (const f of tsxFiles(SRC)) {
  for (const line of findNativeButtonOffenders(readFileSync(f, "utf8"))) {
    offenders++
    console.error(`✗ ${relative(REPO_ROOT, f)}:${line}`)
  }
}

if (offenders > 0) {
  console.error(
    `\n${offenders} <Button render={<Link…/>}> without nativeButton={false}.\n` +
      `Add nativeButton={false} to each.`,
  )
  process.exit(1)
}

console.log("✓ every link-rendered Button sets nativeButton={false}")
