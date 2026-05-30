/**
 * Shared definition of the upstream image hosts we mirror, plus the helpers
 * that find and scan catalog JSON for references to them.
 *
 * `sync:images` (scripts/sync-images.ts) mirrors every URL on these hosts
 * into our R2 bucket and rewrites the catalog to our CDN; `check:images`
 * (scripts/check-image-hosts.ts) is the CI guard that fails if any of these
 * hosts survive in a committed catalog. Both must agree on the exact host
 * set and match pattern, so the single source of truth lives here.
 */

import { readdirSync } from "node:fs"
import { resolve } from "node:path"

/** Upstream image hosts we mirror. URLs on any other host are left untouched
 *  in the catalog (so manually-curated local `/img/...` paths still work). */
export const SOURCE_HOSTS = [
  "content.warframe.com",
  "wiki.warframe.com",
] as const

/** Escape a literal string for embedding in a `RegExp` (here: the `.` in
 *  each host). */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Match every `https://<source-host>/...` URL in a blob of catalog text.
 *  Stops at the first `"` or `\` (JSON string boundary / escape). Derived
 *  from `SOURCE_HOSTS` so the matched host set can't drift between the
 *  sync and the CI guard. Built fresh per call because the `g` flag carries
 *  mutable `lastIndex` state. */
export function sourceUrlRe(): RegExp {
  const hosts = SOURCE_HOSTS.map(escapeRegex).join("|")
  return new RegExp(`https:\\/\\/(?:${hosts})\\/[^"\\\\]+`, "g")
}

/** Recursively collect every `.json` file under `dir`. */
export function findJsonFiles(dir: string): string[] {
  const out: string[] = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, ent.name)
    if (ent.isDirectory()) out.push(...findJsonFiles(path))
    else if (ent.name.endsWith(".json")) out.push(path)
  }
  return out
}
