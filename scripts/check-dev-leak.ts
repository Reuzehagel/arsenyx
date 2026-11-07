/**
 * CI guard: dev-only code (apps/web/src/dev/) must not ship. Its modules read
 * the marker below, so finding it in a built chunk means a dev export was
 * bundled live (e.g. a fixture hook that isn't picked on import.meta.env.DEV).
 * Needs apps/web/dist built first.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const MARKER = "arsenyx-dev-only"
const DIST = resolve(import.meta.dirname, "../apps/web/dist")

const leaks = readdirSync(DIST, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.(js|html)$/.test(f))
  .filter((f) => readFileSync(join(DIST, f), "utf8").includes(MARKER))

if (leaks.length) {
  console.error(
    `check:dev-leak: dev-only code in the prod build:\n  ${leaks.join("\n  ")}`,
  )
  process.exit(1)
}
console.log("check:dev-leak: no dev-only code in apps/web/dist")
