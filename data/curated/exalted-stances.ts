/**
 * Exalted melee weapons carry a Stance mod that is permanently installed and
 * cannot be changed. The stance has Zenurik polarity matching its slot, which
 * grants +10 mod capacity ("All Exalted Stances now grant Mod Capacity just
 * like regular Stances … Zenurik Polarity … +10 capacity boost").
 * Verified against wiki.warframe.com/w/Exalted_Weapon (2026-06-01).
 *
 * DE doesn't export these as catalog Upgrade mods (they're baked into the
 * frame ability), so this curated map drives a locked, pre-filled stance slot
 * in the editor/viewer instead of routing through the normal mod catalog.
 *
 * Keyed by weapon `name` (the merge key). Garuda Talons / Garuda Prime Talons
 * are deliberately ABSENT — they're the documented exception with a *free*
 * Claw stance slot (Madurai polarity), so they get a normal editable stance
 * slot rather than a locked one.
 *
 * `wikiImage` is the wiki File basename; build-items-index resolves it to a
 * self-hosted URL via the wiki-image cache → sync:images. We use each stance's
 * flat ability glyph (`<Ability>130(xWhite).png`) rather than the dedicated
 * stance-mod card (`<Name>StanceMod.png`): the mod cards are drawn in 3/4
 * perspective and look wrong rendered flat in a slot, whereas the glyph reads
 * cleanly (it's also what the in-game arsenal shows for the locked stance).
 * Shadow Claws has no Ravenous Wraith glyph, so it borrows Sevagoth's Exalted
 * Shadow ability glyph. All filenames verified to resolve via the MediaWiki API.
 */

export interface ExaltedStance {
  /** Display name of the fixed stance (e.g. "Serene Storm"). */
  stanceName: string
  /** Wiki File basename, resolved + self-hosted by the image pipeline. */
  wikiImage: string
}

export const EXALTED_STANCES: Record<string, ExaltedStance> = {
  // True exalted melee.
  "Exalted Blade": {
    stanceName: "Exalted Blade",
    wikiImage: "ExaltedBlade130(xWhite).png",
  },
  "Exalted Umbra Blade": {
    stanceName: "Exalted Blade",
    wikiImage: "ExaltedBlade130(xWhite).png",
  },
  "Exalted Prime Blade": {
    stanceName: "Exalted Blade",
    wikiImage: "ExaltedBlade130(xWhite).png",
  },
  "Valkyr Talons": {
    stanceName: "Hysteria",
    wikiImage: "Hysteria130(xWhite).png",
  },
  "Valkyr Prime Talons": {
    stanceName: "Hysteria",
    wikiImage: "Hysteria130(xWhite).png",
  },
  "Iron Staff": {
    stanceName: "Primal Fury",
    wikiImage: "PrimalFury130(xWhite).png",
  },
  "Iron Staff Prime": {
    stanceName: "Primal Fury",
    wikiImage: "PrimalFury130(xWhite).png",
  },
  "Desert Wind": {
    stanceName: "Serene Storm",
    wikiImage: "SereneStorm130(xWhite).png",
  },
  "Desert Wind Prime": {
    stanceName: "Serene Storm",
    wikiImage: "SereneStorm130(xWhite).png",
  },
  Diwata: { stanceName: "Razorwing", wikiImage: "Razorwing130(xWhite).png" },
  "Diwata Prime": {
    stanceName: "Razorwing",
    wikiImage: "Razorwing130(xWhite).png",
  },
  // Shadow Claws has no Ravenous Wraith glyph — borrow Sevagoth's Exalted
  // Shadow ability glyph (the ability that wields the claws).
  "Shadow Claws": {
    stanceName: "Ravenous Wraith",
    wikiImage: "ExaltedShadow130(xWhite).png",
  },
  "Shadow Claws Prime": {
    stanceName: "Ravenous Wraith",
    wikiImage: "ExaltedShadow130(xWhite).png",
  },

  // Pseudo-exalted abilities.
  Whipclaw: { stanceName: "Whipclaw", wikiImage: "Whipclaw130(xWhite).png" },
  "Whipclaw Prime": {
    stanceName: "Whipclaw",
    wikiImage: "Whipclaw130(xWhite).png",
  },
  "Shattered Lash": {
    stanceName: "Shattered Lash",
    wikiImage: "ShatteredLash130(xWhite).png",
  },
  "Shattered Lash Prime": {
    stanceName: "Shattered Lash",
    wikiImage: "ShatteredLash130(xWhite).png",
  },
  "Landslide Fists": {
    stanceName: "Landslide",
    wikiImage: "Landslide130(xWhite).png",
  },
  "Landslide Fists Prime": {
    stanceName: "Landslide",
    wikiImage: "Landslide130(xWhite).png",
  },
  "Shadow Clones": {
    stanceName: "Blade Storm",
    wikiImage: "BladeStorm130(xWhite).png",
  },
  "Shadow Clones Prime": {
    stanceName: "Blade Storm",
    wikiImage: "BladeStorm130(xWhite).png",
  },
}
