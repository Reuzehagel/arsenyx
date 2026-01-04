// Stats Calculator - Main calculation engine for real-time stat updates
// Pure functions with no React dependencies for easy testing

import type { BuildState, PlacedMod, BrowseableItem, Warframe, Gun, Melee, PlacedShard, DamageTypes } from "./types";
import type {
  CalculatedStats,
  WarframeStats,
  WeaponStats,
  StatValue,
  StatContribution,
  ParsedStat,
  StatType,
  DamageType,
  AttackModeStats,
  DamageBreakdown,
  PhysicalDamage,
  ElementalDamage,
} from "./stat-types";
import { BASE_ELEMENTS, ELEMENTAL_COMBINATIONS } from "./stat-types";
import { parseModStats } from "./stat-parser";
import { applyStatCap } from "./stat-caps";
import { findStat as findShardStat } from "./shards";

// Umbral mod set tracking
const UMBRAL_MODS = new Set(["Umbral Vitality", "Umbral Intensify", "Umbral Fiber"]);

// Umbral set bonus multipliers based on count
const UMBRAL_SET_BONUSES: Record<number, number> = {
  1: 1.0, // No bonus with 1 mod
  2: 1.25, // 25% bonus with 2 mods
  3: 1.75, // 75% bonus with 3 mods
};

/**
 * Main entry point - calculate all stats for a build
 */
export function calculateStats(
  item: BrowseableItem,
  buildState: BuildState,
  showMaxStacks = false
): CalculatedStats {
  const category = buildState.itemCategory;

  if (category === "warframes" || category === "necramechs") {
    return {
      warframe: calculateWarframeStats(item as Warframe, buildState, showMaxStacks),
    };
  }

  if (category === "primary" || category === "secondary" || category === "melee") {
    return {
      weapon: calculateWeaponStats(item as Gun | Melee, buildState, showMaxStacks),
    };
  }

  return {};
}

/**
 * Calculate warframe stats including health, shields, armor, energy, and ability stats
 */
export function calculateWarframeStats(
  warframe: Warframe,
  buildState: BuildState,
  showMaxStacks = false
): WarframeStats {
  const mods = getAllPlacedMods(buildState);
  const shards = buildState.shardSlots ?? [];
  const umbralCount = countUmbralMods(mods);

  return {
    health: calculateSingleStat("health", warframe.health, mods, shards, umbralCount, showMaxStacks),
    shield: calculateSingleStat("shield", warframe.shield, mods, shards, umbralCount, showMaxStacks),
    armor: calculateSingleStat("armor", warframe.armor, mods, shards, umbralCount, showMaxStacks),
    energy: calculateSingleStat("energy", warframe.power, mods, shards, umbralCount, showMaxStacks),
    sprintSpeed: calculateSingleStat("sprint_speed", warframe.sprintSpeed ?? 1.0, mods, shards, umbralCount, showMaxStacks),
    abilityStrength: calculateAbilityStat("ability_strength", mods, shards, showMaxStacks),
    abilityDuration: calculateAbilityStat("ability_duration", mods, shards, showMaxStacks),
    abilityEfficiency: calculateAbilityStat("ability_efficiency", mods, shards, showMaxStacks),
    abilityRange: calculateAbilityStat("ability_range", mods, shards, showMaxStacks),
  };
}

/**
 * Calculate weapon stats for guns and melee
 */
export function calculateWeaponStats(
  weapon: Gun | Melee,
  buildState: BuildState,
  showMaxStacks = false
): WeaponStats {
  const mods = getAllPlacedMods(buildState);

  // Calculate multishot
  const multishot = calculateWeaponStat("multishot", 1, mods, showMaxStacks);

  // Build attack mode stats
  const attackModes: AttackModeStats[] = [];

  // Primary attack mode from base weapon stats
  if (weapon.totalDamage || weapon.damage) {
    const baseDamage = weapon.totalDamage ?? 0;
    const baseCrit = weapon.criticalChance ?? 0;
    const baseCritMult = weapon.criticalMultiplier ?? 1;
    const baseStatus = weapon.procChance ?? 0;
    const baseFireRate = weapon.fireRate ?? 1;

    const primaryMode: AttackModeStats = {
      name: "Normal Attack",
      totalDamage: calculateWeaponDamage(baseDamage, mods, showMaxStacks),
      criticalChance: calculateWeaponStat("critical_chance", baseCrit * 100, mods, showMaxStacks, true),
      criticalMultiplier: calculateWeaponStat("critical_multiplier", baseCritMult * 100, mods, showMaxStacks, true),
      statusChance: calculateWeaponStat("status_chance", baseStatus * 100, mods, showMaxStacks, true),
      fireRate: calculateWeaponStat("fire_rate", baseFireRate, mods, showMaxStacks),
      damageBreakdown: calculateDamageBreakdown(weapon.damage ?? {}, mods, showMaxStacks),
    };

    // Add gun-specific stats
    if ("magazineSize" in weapon && weapon.magazineSize) {
      primaryMode.magazineSize = calculateWeaponStat("magazine_size", weapon.magazineSize, mods, showMaxStacks);
    }
    if ("reloadTime" in weapon && weapon.reloadTime) {
      primaryMode.reloadTime = calculateWeaponStat("reload_speed", weapon.reloadTime, mods, showMaxStacks);
    }

    // Add melee-specific stats
    if ("range" in weapon && weapon.range) {
      primaryMode.range = calculateWeaponStat("range", weapon.range, mods, showMaxStacks);
    }

    attackModes.push(primaryMode);
  }

  // Add additional attack modes from attacks array
  if (weapon.attacks && weapon.attacks.length > 0) {
    for (const attack of weapon.attacks) {
      if (attack.name === "Normal Attack") continue; // Skip if already added

      const attackDamage =
        typeof attack.damage === "object" ? sumDamageTypes(attack.damage) : 0;

      const mode: AttackModeStats = {
        name: attack.name,
        totalDamage: calculateWeaponDamage(attackDamage, mods, showMaxStacks),
        criticalChance: calculateWeaponStat(
          "critical_chance",
          (attack.crit_chance ?? weapon.criticalChance ?? 0) * 100,
          mods,
          showMaxStacks,
          true
        ),
        criticalMultiplier: calculateWeaponStat(
          "critical_multiplier",
          (attack.crit_mult ?? weapon.criticalMultiplier ?? 1) * 100,
          mods,
          showMaxStacks,
          true
        ),
        statusChance: calculateWeaponStat(
          "status_chance",
          (attack.status_chance ?? weapon.procChance ?? 0) * 100,
          mods,
          showMaxStacks,
          true
        ),
        fireRate: calculateWeaponStat("fire_rate", attack.speed ?? weapon.fireRate ?? 1, mods, showMaxStacks),
        damageBreakdown: calculateDamageBreakdown(
          typeof attack.damage === "object" ? attack.damage : {},
          mods,
          showMaxStacks
        ),
      };

      attackModes.push(mode);
    }
  }

  return {
    attackModes,
    multishot,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all placed mods from a build state
 */
function getAllPlacedMods(buildState: BuildState): PlacedMod[] {
  const mods: PlacedMod[] = [];

  // Aura slot
  if (buildState.auraSlot?.mod) {
    mods.push(buildState.auraSlot.mod);
  }

  // Exilus slot
  if (buildState.exilusSlot?.mod) {
    mods.push(buildState.exilusSlot.mod);
  }

  // Normal slots
  for (const slot of buildState.normalSlots) {
    if (slot.mod) {
      mods.push(slot.mod);
    }
  }

  return mods;
}

/**
 * Count Umbral mods in the build
 */
function countUmbralMods(mods: PlacedMod[]): number {
  return mods.filter((m) => UMBRAL_MODS.has(m.name)).length;
}

/**
 * Calculate a single warframe stat (health, shield, armor, energy, sprint speed)
 */
function calculateSingleStat(
  statType: StatType,
  baseValue: number,
  mods: PlacedMod[],
  shards: (PlacedShard | null)[],
  umbralCount: number,
  showMaxStacks: boolean
): StatValue {
  const contributions: StatContribution[] = [];
  let flatBonus = 0;
  let percentBonus = 0;

  // Collect mod contributions
  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      if (stat.type === statType) {
        const value = getStatValue(stat, showMaxStacks);

        if (stat.operation === "flat_add") {
          flatBonus += value;
          contributions.push({
            source: "mod",
            name: mod.name,
            absoluteValue: value,
            percentOfBonus: 0, // Calculated later
          });
        } else if (stat.operation === "percent_add") {
          // Apply Umbral set bonus if applicable
          const isUmbral = UMBRAL_MODS.has(mod.name);
          const setMultiplier = isUmbral ? (UMBRAL_SET_BONUSES[umbralCount] ?? 1) : 1;
          const adjustedValue = value * setMultiplier;

          percentBonus += adjustedValue;
          contributions.push({
            source: isUmbral && umbralCount > 1 ? "set_bonus" : "mod",
            name: mod.name,
            absoluteValue: (baseValue * adjustedValue) / 100,
            percentOfBonus: 0,
          });
        }
      }
    }
  }

  // Collect shard contributions
  for (const shard of shards) {
    if (!shard) continue;

    const shardStat = findShardStat(shard.color, shard.stat);
    if (!shardStat) continue;

    // Map shard stat names to our stat types
    const shardStatMap: Record<string, StatType> = {
      Health: "health",
      "Shield Capacity": "shield",
      Armor: "armor",
      "Energy Max": "energy",
      "Parkour Velocity": "sprint_speed",
    };

    const mappedType = shardStatMap[shard.stat];
    if (mappedType === statType) {
      const value = shard.tauforged ? shardStat.tauforgedValue : shardStat.baseValue;

      // Azure shards for health/shield/armor/energy are flat additions
      if (shardStat.unit === "") {
        flatBonus += value;
        contributions.push({
          source: "shard",
          name: `${shard.color.charAt(0).toUpperCase() + shard.color.slice(1)} Archon Shard`,
          absoluteValue: value,
          percentOfBonus: 0,
        });
      } else if (shardStat.unit === "%") {
        percentBonus += value;
        contributions.push({
          source: "shard",
          name: `${shard.color.charAt(0).toUpperCase() + shard.color.slice(1)} Archon Shard`,
          absoluteValue: (baseValue * value) / 100,
          percentOfBonus: 0,
        });
      }
    }
  }

  // Calculate final value
  // Formula: (Base + FlatBonus) × (1 + ΣPercentBonuses/100)
  const modified = (baseValue + flatBonus) * (1 + percentBonus / 100);

  // Calculate percent of bonus for each contribution
  const totalBonus = modified - baseValue;
  if (totalBonus > 0) {
    for (const contrib of contributions) {
      contrib.percentOfBonus = (contrib.absoluteValue / totalBonus) * 100;
    }
  }

  return {
    base: baseValue,
    modified: Math.round(modified * 100) / 100, // Round to 2 decimal places
    contributions,
  };
}

/**
 * Calculate ability stats (percentage-based, 100% = base)
 */
function calculateAbilityStat(
  statType: StatType,
  mods: PlacedMod[],
  shards: (PlacedShard | null)[],
  showMaxStacks: boolean
): StatValue {
  const baseValue = 100; // Ability stats start at 100%
  const contributions: StatContribution[] = [];
  let totalBonus = 0;

  // Collect mod contributions
  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      if (stat.type === statType) {
        const value = getStatValue(stat, showMaxStacks);
        totalBonus += value;

        contributions.push({
          source: "mod",
          name: mod.name,
          absoluteValue: value,
          percentOfBonus: 0,
        });
      }
    }
  }

  // Collect shard contributions for ability stats
  for (const shard of shards) {
    if (!shard) continue;

    const shardStat = findShardStat(shard.color, shard.stat);
    if (!shardStat) continue;

    const shardStatMap: Record<string, StatType> = {
      "Ability Strength": "ability_strength",
      "Ability Duration": "ability_duration",
    };

    const mappedType = shardStatMap[shard.stat];
    if (mappedType === statType && shardStat.unit === "%") {
      const value = shard.tauforged ? shardStat.tauforgedValue : shardStat.baseValue;
      totalBonus += value;

      contributions.push({
        source: "shard",
        name: `${shard.color.charAt(0).toUpperCase() + shard.color.slice(1)} Archon Shard`,
        absoluteValue: value,
        percentOfBonus: 0,
      });
    }
  }

  const modified = baseValue + totalBonus;

  // Apply stat cap
  const capResult = applyStatCap(statType, modified);

  // Calculate percent of bonus
  const actualBonus = Math.abs(totalBonus);
  if (actualBonus > 0) {
    for (const contrib of contributions) {
      contrib.percentOfBonus = (Math.abs(contrib.absoluteValue) / actualBonus) * 100;
    }
  }

  return {
    base: baseValue,
    modified: capResult.value,
    capped: capResult.uncapped,
    contributions,
  };
}

/**
 * Calculate a weapon stat
 */
function calculateWeaponStat(
  statType: StatType,
  baseValue: number,
  mods: PlacedMod[],
  showMaxStacks: boolean,
  isPercentStat = false
): StatValue {
  const contributions: StatContribution[] = [];
  let percentBonus = 0;

  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      if (stat.type === statType && stat.operation === "percent_add") {
        const value = getStatValue(stat, showMaxStacks);
        percentBonus += value;

        contributions.push({
          source: "mod",
          name: mod.name,
          absoluteValue: isPercentStat ? value : (baseValue * value) / 100,
          percentOfBonus: 0,
        });
      }
    }
  }

  // For percentage stats (crit, status), add the bonus directly
  // For other stats (fire rate, magazine), multiply
  const modified = isPercentStat
    ? baseValue + percentBonus
    : baseValue * (1 + percentBonus / 100);

  // Calculate percent of bonus
  const totalBonus = modified - baseValue;
  if (Math.abs(totalBonus) > 0.001) {
    for (const contrib of contributions) {
      contrib.percentOfBonus = (Math.abs(contrib.absoluteValue) / Math.abs(totalBonus)) * 100;
    }
  }

  return {
    base: baseValue,
    modified: Math.round(modified * 100) / 100,
    contributions,
  };
}

/**
 * Calculate weapon damage with base damage mods
 */
function calculateWeaponDamage(
  baseDamage: number,
  mods: PlacedMod[],
  showMaxStacks: boolean
): StatValue {
  const contributions: StatContribution[] = [];
  let percentBonus = 0;

  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      // "damage" type applies to base damage
      if (stat.type === "damage" && stat.operation === "percent_add") {
        const value = getStatValue(stat, showMaxStacks);
        percentBonus += value;

        contributions.push({
          source: "mod",
          name: mod.name,
          absoluteValue: (baseDamage * value) / 100,
          percentOfBonus: 0,
        });
      }
    }
  }

  const modified = baseDamage * (1 + percentBonus / 100);

  // Calculate percent of bonus
  const totalBonus = modified - baseDamage;
  if (totalBonus > 0) {
    for (const contrib of contributions) {
      contrib.percentOfBonus = (contrib.absoluteValue / totalBonus) * 100;
    }
  }

  return {
    base: baseDamage,
    modified: Math.round(modified * 10) / 10, // Round to 1 decimal
    contributions,
  };
}

/**
 * Calculate damage breakdown with elemental combinations
 */
function calculateDamageBreakdown(
  baseDamage: DamageTypes,
  mods: PlacedMod[],
  showMaxStacks: boolean
): DamageBreakdown {
  // Get base damage multiplier from damage mods
  let baseDamageMultiplier = 1;
  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      if (stat.type === "damage" && stat.operation === "percent_add") {
        baseDamageMultiplier += getStatValue(stat, showMaxStacks) / 100;
      }
    }
  }

  // Calculate physical damage (IPS)
  const physical: PhysicalDamage = {};
  if (baseDamage.impact) {
    physical.impact = Math.round(baseDamage.impact * baseDamageMultiplier * getPhysicalMultiplier("impact", mods, showMaxStacks));
  }
  if (baseDamage.puncture) {
    physical.puncture = Math.round(baseDamage.puncture * baseDamageMultiplier * getPhysicalMultiplier("puncture", mods, showMaxStacks));
  }
  if (baseDamage.slash) {
    physical.slash = Math.round(baseDamage.slash * baseDamageMultiplier * getPhysicalMultiplier("slash", mods, showMaxStacks));
  }

  // Calculate total modded base damage (for elemental calculation)
  const totalModdedBase =
    (physical.impact ?? 0) + (physical.puncture ?? 0) + (physical.slash ?? 0);

  // Collect elemental mods in order
  const elementalMods: { type: DamageType; value: number; modName: string }[] = [];

  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      if (BASE_ELEMENTS.includes(stat.type as DamageType) && stat.operation === "percent_add") {
        elementalMods.push({
          type: stat.type as DamageType,
          value: getStatValue(stat, showMaxStacks),
          modName: mod.name,
        });
      }
    }
  }

  // Add innate weapon elements
  for (const [type, value] of Object.entries(baseDamage)) {
    if (BASE_ELEMENTS.includes(type as DamageType) && value && value > 0) {
      // Innate elements come first in combination order
      elementalMods.unshift({
        type: type as DamageType,
        value: (value / (totalModdedBase || 1)) * 100, // Convert to percentage
        modName: "Innate",
      });
    }
  }

  // Combine elements in slot order
  const elemental = combineElements(elementalMods, totalModdedBase);

  return { physical, elemental };
}

/**
 * Get physical damage type multiplier from mods
 */
function getPhysicalMultiplier(
  type: "impact" | "puncture" | "slash",
  mods: PlacedMod[],
  showMaxStacks: boolean
): number {
  let multiplier = 1;

  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      if (stat.type === type && stat.operation === "percent_add") {
        multiplier += getStatValue(stat, showMaxStacks) / 100;
      }
    }
  }

  return multiplier;
}

/**
 * Combine elemental types according to Warframe's combination rules
 */
function combineElements(
  elements: { type: DamageType; value: number; modName: string }[],
  baseDamage: number
): ElementalDamage[] {
  if (elements.length === 0) return [];

  const result: ElementalDamage[] = [];
  const remaining = [...elements];

  while (remaining.length > 0) {
    const first = remaining.shift()!;

    // Look for a combinable element
    let combined = false;
    for (let i = 0; i < remaining.length; i++) {
      const second = remaining[i];
      const combinedType = ELEMENTAL_COMBINATIONS[`${first.type}+${second.type}`];

      if (combinedType) {
        // Combine these elements
        const totalValue = (baseDamage * (first.value + second.value)) / 100;
        result.push({
          type: combinedType,
          value: Math.round(totalValue),
          sources: [first.modName, second.modName],
        });
        remaining.splice(i, 1);
        combined = true;
        break;
      }
    }

    if (!combined) {
      // This element doesn't combine, add it as-is
      result.push({
        type: first.type,
        value: Math.round((baseDamage * first.value) / 100),
        sources: [first.modName],
      });
    }
  }

  return result;
}

/**
 * Get the effective value of a parsed stat, considering max stacks
 */
function getStatValue(stat: ParsedStat, showMaxStacks: boolean): number {
  if (stat.isConditional && showMaxStacks && stat.maxStacks) {
    return stat.value * stat.maxStacks;
  }
  return stat.value;
}

/**
 * Sum all damage types to get total damage
 */
function sumDamageTypes(damage: DamageTypes): number {
  return Object.values(damage).reduce<number>((sum, val) => sum + (val ?? 0), 0);
}

/**
 * Check if a build has any conditional mods
 */
export function buildHasConditionalMods(buildState: BuildState): boolean {
  const mods = getAllPlacedMods(buildState);

  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    if (parsedStats.some((s) => s.isConditional)) {
      return true;
    }
  }

  return false;
}
