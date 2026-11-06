/**
 * Beast-claw mod routing. DE ships beast-claw mods (Maul, Bite, Frost Jaw,
 * Sepsis Claws, Beast Postures, Hunter Synergy, …) with compatName "Claws" —
 * the same string player melee Claws mods use — so without disambiguation
 * they leak onto weapon Claws (Venka, Ripkas, Garuda Talons).
 */

/** DE path fragments that mark a compatName="Claws" mod as a beast-claw mod;
 *  merge-mods.ts remaps those to the "BeastClaws" pool (paired with
 *  "BeastClaws" in class-pools.ts). Player claw stances live under
 *  /MeleeTrees/ and /PvPMods/ and must NOT match. */
export const BEAST_CLAW_MOD_PATHS: readonly string[] = [
  "/Sentinel/Kubrow/",
  "/BeastWeapons/",
  "/Sets/Hunter/",
]

/** Extra pools a wiki-only beast claw (Class "Claws (Beast)") gets from the
 *  companion that wields it (wiki `Users[0]`, e.g. "Adarza Kavat"). Routes
 *  Swipe-style class-specific claw mods (compat "Kavat Claws" / "Kubrow
 *  Claws"). A rule matches when the user ends with one of `suffixes` or is one
 *  of `users`; every matching rule's pools are added, in order.
 *
 *  Vulpaphyla are infested catbrows and Predasites infested kubrows, so their
 *  claws share the Kavat/Kubrow claw pools (Swipe — "Kavat Claws" — equips on
 *  Sly/Crescent/Panzer Claws in-game; the wiki groups the category as "Kavat
 *  Claws (Vulpaphyla Claws)"). Venari (Khora's built-in Kavat) and its Prime
 *  are Kavat Claws too, but the wiki lists them as bare "Venari" /
 *  "Venari Prime". Per-pet mods ("Adarza Kavat") are pet-side, routed by the
 *  companion's own modPools, not here. */
export const BEAST_CLAW_USER_POOLS: ReadonlyArray<{
  suffixes?: readonly string[]
  users?: readonly string[]
  pools: readonly string[]
}> = [
  {
    suffixes: [" Kavat", " Vulpaphyla"],
    users: ["Venari", "Venari Prime"],
    pools: ["Kavat Claws"],
  },
  { suffixes: [" Kubrow", " Predasite"], pools: ["Kubrow Claws"] },
  { users: ["Helminth Charger"], pools: ["Helminth Claws", "Kubrow Claws"] },
]
