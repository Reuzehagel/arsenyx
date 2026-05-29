/**
 * Per-name modPool overrides.
 *
 * Default rule for the build (in scripts/build/merge-weapons.ts):
 *   modPools = CLASS_DEFAULT_POOLS[wikiClass]  ∪  [weapon.name]  ∪  family extras
 *
 * This file is the small per-name override layer applied on top of that
 * default. Use it when class-level inference would route the weapon to the
 * wrong pool — overwhelmingly that's the Arm-Cannon family (Shedu pulls
 * from Rifle, Bubonico from Shotgun, Sepulcrum from Pistol; nothing about
 * Class or CompatibilityTags can tell them apart structurally).
 *
 * Each override REPLACES the class-default pool list. The weapon's own name
 * is still appended for augment compatibility.
 *
 * Verified: this list should stay under ~20 entries. If it grows, the
 * class-level default rule probably needs tightening.
 */

/** Override pool list for specific weapon names. */
export const MOD_POOL_OVERRIDES: Record<string, readonly string[]> = {
  // Arm-Cannon family — wiki Class doesn't disambiguate which mod pool
  // each draws from. Verified 2026-05-27 against the wiki.
  Shedu: ["Rifle"],
  Bubonico: ["Shotgun"],
  "Coda Bubonico": ["Shotgun"],
  Sepulcrum: ["Pistol"],
  // Cyte-09's exalted weapon is the Neutralizer (an exalted sniper rifle),
  // not an arm-cannon — leave to default for now.

  // Exalted weapons — wiki Class is "Exalted Weapon" with no per-frame
  // routing data, so we override with the actual mod pools each draws
  // from. The build adds the weapon's own name on top for augment hooks.
  Noctua: ["Pistol", "Tome"],
  Grimoire: ["Pistol", "Tome"],
  "Exalted Blade": ["Melee", "Swords"],
  "Exalted Umbra Blade": ["Melee", "Swords"],
  "Exalted Prime Blade": ["Melee", "Swords"],
  "Garuda Talons": ["Melee", "Claws"],
  "Garuda Prime Talons": ["Melee", "Claws"],
  "Valkyr Talons": ["Melee", "Claws"],
  "Valkyr Prime Talons": ["Melee", "Claws"],
  "Shadow Claws": ["Melee", "Claws"],
  "Shadow Claws Prime": ["Melee", "Claws"],
  "Iron Staff": ["Melee", "Staves"],
  "Iron Staff Prime": ["Melee", "Staves"],
  Diwata: ["Melee", "Swords"],
  "Diwata Prime": ["Melee", "Swords"],
  "Desert Wind": ["Melee", "Sparring"],
  "Desert Wind Prime": ["Melee", "Sparring"],
  "Whipclaw": ["Melee"],
  "Whipclaw Prime": ["Melee"],
  // Pseudo-exalted abilities — independently moddable with melee mods, but
  // can't slot a stance, so no stance sub-pool. (Verified against the wiki.)
  "Landslide Fists": ["Melee"],
  "Landslide Fists Prime": ["Melee"],
  "Shattered Lash": ["Melee"],
  "Shattered Lash Prime": ["Melee"],
  "Shadow Clones": ["Melee"],
  "Shadow Clones Prime": ["Melee"],
  // Glory (Jade) uses Pistol mods; Lizzie (Temple) uses Rifle mods.
  Glory: ["Pistol"],
  Lizzie: ["Rifle"],
  // Exalted ranged weapons that route to the Pistol pool: Balefire
  // (Hildryn), Dex Pixia (Titania), Regulators (Mesa).
  "Balefire Charger": ["Pistol"],
  "Balefire Charger Prime": ["Pistol"],
  "Dex Pixia": ["Pistol"],
  "Dex Pixia Prime": ["Pistol"],
  Regulators: ["Pistol"],
  "Regulators Prime": ["Pistol"],
  // Ivara's exalted bow is Primary/Bow:
  "Artemis Bow": ["Rifle", "Bow"],
  "Artemis Bow Prime": ["Rifle", "Bow"],
  // Cyte-09's exalted sniper rifle:
  Neutralizer: ["Rifle", "Sniper"],
  // Necramech exalteds — Arquebex (Archgun) / Ironbride (Archmelee).
  Arquebex: ["Archgun"],
  Ironbride: ["Archmelee"],
  // Mausolon is the standard Necramech archgun (Voidrig/Bonewidow share
  // it) — not exalted, but its wiki Class still needs routing to the
  // Archgun pool. The Atmosphere variant is the ground-deploy form.
  Mausolon: ["Archgun"],
  "Mausolon (Atmosphere)": ["Archgun"],
}
