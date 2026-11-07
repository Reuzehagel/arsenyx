/**
 * Per-frame routing the DE/wiki data can't express on its own.
 */

/** Twin-frames that DE ships as two separate `ExportWarframes` rows sharing a
 *  uniqueName prefix (one codex-visible "Suits" row + one `excludeFromCodex`
 *  "SpecialItems" row). The build collapses each pair into ONE catalog entity
 *  carrying both ability sets under `forms` (merge-frames.ts
 *  `collapseTwinFrames`). `primaryUnique` is the form players control by
 *  default and the one Helminth can infuse on — it becomes `forms[0]` and the
 *  top-level (back-compat) abilities/passive/exalted. */
export const TWIN_FRAMES: ReadonlyArray<{
  prefix: string
  primaryUnique: string
}> = [
  {
    prefix: "/Lotus/Powersuits/SiriusOrion/",
    primaryUnique: "/Lotus/Powersuits/SiriusOrion/SiriusSuit",
  },
]

/** DE frame rows that aren't buildable frames, so they get no browse card or
 *  detail file. Helminth ships as a `Suits` row but is the infusion system. */
export const NON_BUILDABLE_FRAMES: ReadonlySet<string> = new Set(["Helminth"])
