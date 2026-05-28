/**
 * Curated `name → { releaseDate?, vaulted? }` snapshot.
 *
 * See ./README-release-history.md for the why.
 *
 * Lives in JSON beside this module so it's machine-editable from
 * snapshot scripts without churning a TypeScript file's formatting.
 *
 * Keyed by display name ("Braton Prime"), not DE uniqueName, so it
 * matches the wiki Vault page structure and survives DE uniqueName
 * drift.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

export interface ReleaseHistoryEntry {
  releaseDate?: string
  vaulted?: boolean
}

const PATH = resolve(import.meta.dirname, "release-history.json")

export const RELEASE_HISTORY: Record<string, ReleaseHistoryEntry> = JSON.parse(
  readFileSync(PATH, "utf8"),
) as Record<string, ReleaseHistoryEntry>
