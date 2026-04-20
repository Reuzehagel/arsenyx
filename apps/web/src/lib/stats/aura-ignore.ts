/**
 * Auras whose effects don't contribute to the warframe stat panel — they
 * target enemies, squadmates, weapons, or provide regen/utility that isn't a
 * modifier on health/shield/armor/energy/sprint/ability. Including them would
 * produce wrong numbers (e.g. Corrosive Projection subtracting enemy armor
 * from the player's armor rating, or Shield Disruption stripping player
 * shields).
 *
 * Self-affecting auras (Physique, Stand United, Sprint Boost, Power Donation,
 * Growing Power, Toxin Resistance, Aerodynamic, …) are intentionally absent so
 * their stats still flow through.
 */
export const EXCLUDED_WARFRAME_AURAS = new Set<string>([
  // Enemy-targeting
  "Corrosive Projection",
  "EMP Aura",
  "Enemy Radar",
  "Infested Impedance",
  "Loot Detector",
  "Shield Disruption",

  // Weapon-only buffs (belong to weapon stats, not warframe stats)
  "Dead Eye",
  "Empowered Blades",
  "Holster Amp",
  "Mecha Empowered",
  "Pistol Amp",
  "Ready Steel",
  "Rifle Amp",
  "Shotgun Amp",
  "Steel Charge",
  "Swift Momentum",
  "Worthy Comradery",

  // Companion / summon buffs
  "Shepherd",
  "Summoner's Wrath",

  // Regen / ammo / utility (not modeled as a stat-panel modifier)
  "Brief Respite",
  "Combat Discipline",
  "Dreamer's Bond",
  "Energy Siphon",
  "Melee Guidance",
  "Pistol Scavenger",
  "Rejuvenation",
  "Rifle Scavenger",
  "Shotgun Scavenger",
  "Sniper Scavenger",
  "Speed Holster",
])
