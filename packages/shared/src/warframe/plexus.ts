/** Railjack Plexus routing shared by the data pipeline and the app. */

/** `type` the build stamps on every avionic (DE ships them untyped). Match it
 *  with `isPlexusMod` (mods.ts), not by string compare. */
export const PLEXUS_MOD_TYPE = "Plexus Mod"

/** compatName of every avionic, and the synthetic Plexus item's only modPool. */
export const PLEXUS_POOL = "Plexus"
