/**
 * Read curated TS modules from `data/curated/`.
 *
 * These are checked-in TypeScript constants (not YAML — type-safe and
 * reviewable in diffs). The build script imports them
 * directly. This module is the single entrypoint so consumers don't need
 * to know which file each curated table lives in.
 */

import {
  CLASS_DEFAULT_POOLS,
  ALL_MENTIONED_POOLS,
} from "../../data/curated/class-pools"
import {
  EXALTED_STANCES,
  type ExaltedStance,
} from "../../data/curated/exalted-stances"
import {
  FRAME_POLARITY_OVERRIDES,
  type FramePolarityOverride,
} from "../../data/curated/frame-polarities"
import { MOD_POOL_OVERRIDES } from "../../data/curated/mod-pools"
import { PLEXUS_BROWSE_ITEM, PLEXUS_DETAIL } from "../../data/curated/plexus"
import {
  RELEASE_HISTORY,
  type ReleaseHistoryEntry,
} from "../../data/curated/release-history"
import { WIKI_ALIASES } from "../../data/curated/wiki-aliases"
import { WIKI_STUBS } from "../../data/curated/wiki-stubs"

export interface CuratedData {
  classPools: Record<string, readonly string[]>
  /** Every pool mentioned anywhere in classPools — for KNOWN_MOD_POOLS validation. */
  allMentionedPools: Set<string>
  modPoolOverrides: Record<string, readonly string[]>
  wikiAliases: Record<string, string>
  wikiStubs: typeof WIKI_STUBS
  plexusBrowse: typeof PLEXUS_BROWSE_ITEM
  plexusDetail: typeof PLEXUS_DETAIL
  /** Name → { releaseDate?, vaulted? } from curated snapshot. */
  releaseHistory: Record<string, ReleaseHistoryEntry>
  /** Weapon name → permanently-installed exalted stance (locked slot). */
  exaltedStances: Record<string, ExaltedStance>
  /** Frame name → wiki-verified polarity fallback (for frames the wiki data
   *  module hasn't catalogued yet). The wiki wins when it has data. */
  framePolarities: Record<string, FramePolarityOverride>
}

export function readCurated(): CuratedData {
  return {
    classPools: CLASS_DEFAULT_POOLS,
    allMentionedPools: ALL_MENTIONED_POOLS,
    modPoolOverrides: MOD_POOL_OVERRIDES,
    wikiAliases: WIKI_ALIASES,
    wikiStubs: WIKI_STUBS,
    plexusBrowse: PLEXUS_BROWSE_ITEM,
    plexusDetail: PLEXUS_DETAIL,
    releaseHistory: RELEASE_HISTORY,
    exaltedStances: EXALTED_STANCES,
    framePolarities: FRAME_POLARITY_OVERRIDES,
  }
}
