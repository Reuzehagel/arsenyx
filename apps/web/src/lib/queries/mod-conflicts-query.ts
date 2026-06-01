import type { ModConflictMap } from "@arsenyx/shared/warframe/mods"

import { staticDataQuery } from "./static-data-query"

/**
 * `uniqueName → mutually-exclusive mod uniqueNames`. Lets the editor block (and
 * the viewer flag) illegal loadouts that stack variants of the same base mod —
 * e.g. Serration + Amalgam Serration + Spectral Serration. Built from the
 * wiki's per-mod `Incompatible` lists (see scripts/build-items-index.ts) and
 * tiny vs. the full mod catalog, so a build page can validate without the
 * ~1.2 MB mods-all.json download.
 */
export const modConflictsQuery = staticDataQuery<ModConflictMap>(
  ["mod-conflicts"],
  "/data/mod-conflicts.json",
  "failed to load mod conflicts",
)
