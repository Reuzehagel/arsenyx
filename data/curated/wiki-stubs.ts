/**
 * Wiki-stub escape hatch.
 *
 * When DE ships a new weapon before wiki editors document it, the merge
 * step has no wiki record to draw `displayClass` / `Polarities` /
 * `CompatibilityTags` from. Without an escape hatch, the build would fail
 * loud on every data bump after a new release.
 *
 * Entries here key by `uniqueName` and supply the minimum the merge needs
 * to emit a usable record. `stubUntil` is an ISO date — the build warns
 * for every active stub on every run, and CI fails outright once a stub is
 * past its expiry (forcing cleanup once the wiki catches up).
 */

export interface WikiStub {
  /** Wiki `Class` value to use until the wiki has it. */
  displayClass: string
  /** Mod-pool list, replacing the default class lookup. */
  modPools?: readonly string[]
  /** Polarities, if known from the in-game item view. */
  polarities?: readonly string[]
  /** Exilus polarity, if known. */
  exilusPolarity?: string | null
  /** Variant family this weapon belongs to (e.g. "Bubonico" for variants). */
  family?: string
  /** ISO date string after which CI fails. */
  stubUntil: string
}

/** uniqueName → stub. */
export const WIKI_STUBS: Record<string, WikiStub> = {
  // (populate when a new DE weapon lands before wiki coverage)
}
