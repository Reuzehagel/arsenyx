/**
 * Per-wiki-Class default modPool routing.
 *
 * `modPool = displayClass` only holds for gun-class weapons where the wiki
 * Class name happens to be the same as DE's compatName (Rifle, Shotgun,
 * Pistol, …). For everything else — especially melees, which have 30+ wiki
 * Class values that all collapse to the single "Melee" mod pool — we need
 * an explicit table.
 *
 * This is the **class default**. Per-weapon overrides live in
 * `mod-pools.ts`. The merge step also appends the weapon's own name (and
 * base name for Kuva/Tenet/Coda variants) so weapon-specific augments
 * (Hek, Vulkar, Excalibur, …) match without enumeration here.
 *
 * Stance mod compatNames are PLURAL ("Polearms", "Hammers"). Weapon Class
 * is SINGULAR ("Polearm", "Hammer"). The mapping below handles the
 * plural-singular flip.
 *
 * Values must be a subset of `KNOWN_MOD_POOLS` in merge-weapons.ts (which
 * fails loud on drift).
 */

/** Wiki Class → list of DE mod compatNames the weapon accepts. */
export const CLASS_DEFAULT_POOLS: Record<string, readonly string[]> = {
  // ──────── Primary weapons ────────
  Rifle: ["Rifle"],
  Shotgun: ["Shotgun"],
  "Sniper Rifle": ["Rifle", "Sniper"],
  Bow: ["Rifle", "Bow"],
  Crossbow: ["Rifle"],
  Launcher: ["Rifle"],
  Speargun: ["Rifle"],
  "Arm-Cannon": [], // explicit override required (Shedu/Bubonico/Sepulcrum)

  // ──────── Secondary weapons ────────
  Pistol: ["Pistol"],
  "Dual Pistols": ["Pistol"],
  "Dual Shotguns": ["Shotgun", "Pistol"],
  "Shotgun Sidearm": ["Pistol", "Shotgun"],
  Thrown: ["Pistol", "Thrown"],
  Tome: ["Pistol", "Tome"],

  // ──────── Melee weapons (all collapse to "Melee" plus class-specific stances) ────────
  Polearm: ["Melee", "Polearms"],
  Hammer: ["Melee", "Hammers"],
  Sword: ["Melee", "Swords"],
  "Dual Swords": ["Melee", "Dual Swords"],
  "Heavy Blade": ["Melee", "Heavy Blade"],
  "Heavy Scythe": ["Melee", "Heavy Scythe"],
  Scythe: ["Melee", "Scythes"],
  Dagger: ["Melee", "Daggers"],
  "Dual Daggers": ["Melee", "Dual Daggers"],
  Fist: ["Melee", "Fists"],
  Sparring: ["Melee", "Sparring"],
  Staff: ["Melee", "Staves"],
  Nikana: ["Melee", "Nikanas"],
  "Dual Nikanas": ["Melee", "Dual Nikanas"],
  "Two-Handed Nikana": ["Melee", "Two-Handed Nikana"],
  Tonfa: ["Melee", "Tonfas"],
  Rapier: ["Melee", "Rapiers"],
  Glaive: ["Melee", "Thrown Melee", "Glaives"],
  Gunblade: ["Melee", "Gunblade"],
  Machete: ["Melee", "Machetes"],
  Whip: ["Melee", "Whips"],
  "Blade and Whip": ["Melee", "Blade And Whip"],
  Warfan: ["Melee", "Warfans"],
  Nunchaku: ["Melee", "Nunchaku"],
  Bayonet: ["Melee"],
  "Sword and Shield": ["Melee", "Sword And Shield"],
  Claws: ["Melee", "Claws"],
  "Assault Saw": ["Melee", "Assault Saw"],

  // ──────── Archwing ────────
  Archgun: ["Archgun"],
  Archmelee: ["Archmelee"],

  // ──────── Railjack ────────
  Ordnance: ["Plexus"],
  Turret: ["Plexus"],

  // ──────── Companion weapons ────────
  // The Class field on Module:Weapons/data/companion uses a mix of
  // class-style ("Rifle", "Shotgun", "Sniper Rifle", "Glaive") and the
  // generic "Melee". Most pull from the same pools as their player-weapon
  // analogues (a Sweeper takes shotgun mods, a Deth Machine Rifle takes
  // rifle mods); Deconstructor (a thrown glaive) takes Melee + Thrown Melee.
  // Beast claws (Sahasa Claws, Adarza Claws, …) use a separate mod pool
  // from player Claws weapons. The pool name "BeastClaws" is synthesized
  // in merge-mods.ts (DE ships beast mods with compatName "Claws", which
  // would otherwise leak them onto Venka/Garuda Talons/etc.).
  "Claws (Beast)": ["BeastClaws", "BEAST"],
  Melee: ["Melee"], // companion weapon variant

  // ──────── Modular Zaw classes ────────
  // Zaws share the "Melee" pool plus their stance-compat class. Built up
  // ad-hoc — these are coarse buckets and zaws aren't yet exposed in the
  // planner UI.
  "Zaw Dagger / Staff": ["Melee", "Daggers", "Staves"],
  "Zaw Machete / Hammer": ["Melee", "Machetes", "Hammers"],
  "Zaw Machete / Polearm": ["Melee", "Machetes", "Polearms"],
  "Zaw Nikana / Staff": ["Melee", "Nikanas", "Staves"],
  "Zaw Rapier / Polearm": ["Melee", "Rapiers", "Polearms"],
  "Zaw Scythe / Heavy Blade": ["Melee", "Scythes", "Heavy Blade"],
  "Zaw Scythe / Staff": ["Melee", "Scythes", "Staves"],
  "Zaw Sword / Polearm": ["Melee", "Swords", "Polearms"],
  "Zaw Sword / Staff": ["Melee", "Swords", "Staves"],

  // ──────── Modular / misc ────────
  Amp: ["Amp"],
  "Exalted Weapon": [], // resolved per-name via the wielding warframe
  "Fishing Spear": [],
  Parazon: ["Parazon"],
  Enemy: [],
  Unique: [],
}

/** Sanity: every value here is a pool we want to assert in merge-weapons. */
export const ALL_MENTIONED_POOLS: Set<string> = new Set(
  Object.values(CLASS_DEFAULT_POOLS).flatMap((p) => [...p]),
)
