/**
 * Shared definition of the upstream image hosts we mirror, plus the matcher
 * that scans catalog JSON for references to them.
 *
 * `sync:images` (scripts/sync-images.ts) mirrors every URL on these hosts
 * into our R2 bucket and rewrites the catalog to our CDN; `check:images`
 * (scripts/check-image-hosts.ts) is the CI guard that fails if any of these
 * hosts survive in a committed catalog. Both must agree on the exact host
 * set and match pattern, so the matcher lives here; the host list itself is
 * shared with the web app's image allowlist.
 */

import {
  UPSTREAM_IMAGE_HOSTS,
  type UpstreamImageHost,
} from "@arsenyx/shared/warframe/image-hosts"

/** Upstream image hosts we mirror. URLs on any other host are left untouched
 *  in the catalog (so manually-curated local `/img/...` paths still work). */
const SOURCE_HOSTS = Object.keys(UPSTREAM_IMAGE_HOSTS) as UpstreamImageHost[]

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
