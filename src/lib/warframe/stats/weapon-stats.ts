// Weapon-specific stat calculations (guns and melee)

import type {
  BuildState,
  PlacedMod,
  Gun,
  Melee,
  DamageTypes,
} from "../types";
import type {
  WeaponStats,
  StatValue,
  StatContribution,
  StatType,
  DamageType,
  AttackModeStats,
  DamageBreakdown,
  PhysicalDamage,
  ElementalDamage,
} from "../stat-types";
import { BASE_ELEMENTS, ELEMENTAL_COMBINATIONS } from "../stat-types";
import { parseModStats } from "../stat-parser";
import { getAllPlacedMods, getStatValue, sumDamageTypes } from "./stat-engine";

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

  // Check if weapon has specific attack modes defined
  const hasSpecificAttackModes = weapon.attacks && weapon.attacks.length > 0;

  // Primary attack mode from base weapon stats
  // Only create "Normal Attack" if there are no specific attack modes defined
  if (!hasSpecificAttackModes && (weapon.totalDamage || weapon.damage)) {
    const baseDamage = weapon.totalDamage ?? 0;
    const baseCrit = weapon.criticalChance ?? 0;
    const baseCritMult = weapon.criticalMultiplier ?? 1;
    const baseStatus = weapon.procChance ?? 0;
    const baseFireRate = weapon.fireRate ?? 1;

    const primaryMode: AttackModeStats = {
      name: "Normal Attack",
      totalDamage: calculateWeaponDamage(baseDamage, mods, showMaxStacks),
      criticalChance: calculateWeaponStat(
        "critical_chance",
        baseCrit * 100,
        mods,
        showMaxStacks
      ),
      criticalMultiplier: calculateWeaponStat(
        "critical_multiplier",
        baseCritMult,
        mods,
        showMaxStacks
      ),
      statusChance: calculateWeaponStat(
        "status_chance",
        baseStatus * 100,
        mods,
        showMaxStacks
      ),
      fireRate: calculateWeaponStat(
        "fire_rate",
        baseFireRate,
        mods,
        showMaxStacks
      ),
      damageBreakdown: calculateDamageBreakdown(
        weapon.damage ?? {},
        mods,
        showMaxStacks
      ),
    };

    // Add gun-specific stats
    if ("magazineSize" in weapon && weapon.magazineSize) {
      primaryMode.magazineSize = calculateWeaponStat(
        "magazine_size",
        weapon.magazineSize,
        mods,
        showMaxStacks
      );
    }
    if ("reloadTime" in weapon && weapon.reloadTime) {
      primaryMode.reloadTime = calculateWeaponStat(
        "reload_speed",
        weapon.reloadTime,
        mods,
        showMaxStacks
      );
    }

    // Add melee-specific stats
    if ("range" in weapon && weapon.range) {
      primaryMode.range = calculateWeaponStat(
        "range",
        weapon.range,
        mods,
        showMaxStacks
      );
    }

    attackModes.push(primaryMode);
  }

  // Add additional attack modes from attacks array
  if (weapon.attacks && weapon.attacks.length > 0) {
    for (const attack of weapon.attacks) {
      // Skip "Normal Attack" only if we already created it from base weapon stats above
      if (attack.name === "Normal Attack" && attackModes.length > 0) continue;

      const attackDamage =
        typeof attack.damage === "object" ? sumDamageTypes(attack.damage) : 0;

      // WFCD attack mode stats may be in percentage form (34) or decimal form (0.34)
      // Values > 1 are already percentages, values <= 1 need to be multiplied by 100
      const rawCrit = attack.crit_chance ?? weapon.criticalChance ?? 0;
      const critBase = rawCrit > 1 ? rawCrit : rawCrit * 100;

      // Critical multiplier is stored as actual multiplier (e.g., 3 for 3x)
      const critMultBase = attack.crit_mult ?? weapon.criticalMultiplier ?? 1;

      const rawStatus = attack.status_chance ?? weapon.procChance ?? 0;
      const statusBase = rawStatus > 1 ? rawStatus : rawStatus * 100;

      const mode: AttackModeStats = {
        name: attack.name,
        totalDamage: calculateWeaponDamage(attackDamage, mods, showMaxStacks),
        criticalChance: calculateWeaponStat(
          "critical_chance",
          critBase,
          mods,
          showMaxStacks
        ),
        criticalMultiplier: calculateWeaponStat(
          "critical_multiplier",
          critMultBase,
          mods,
          showMaxStacks
        ),
        statusChance: calculateWeaponStat(
          "status_chance",
          statusBase,
          mods,
          showMaxStacks
        ),
        fireRate: calculateWeaponStat(
          "fire_rate",
          attack.speed ?? weapon.fireRate ?? 1,
          mods,
          showMaxStacks
        ),
        damageBreakdown: calculateDamageBreakdown(
          typeof attack.damage === "object" ? attack.damage : {},
          mods,
          showMaxStacks
        ),
      };

      // Add gun-specific stats (shared across attack modes)
      if ("magazineSize" in weapon && weapon.magazineSize) {
        mode.magazineSize = calculateWeaponStat(
          "magazine_size",
          weapon.magazineSize,
          mods,
          showMaxStacks
        );
      }
      if ("reloadTime" in weapon && weapon.reloadTime) {
        mode.reloadTime = calculateWeaponStat(
          "reload_speed",
          weapon.reloadTime,
          mods,
          showMaxStacks
        );
      }

      // Add melee-specific stats
      if ("range" in weapon && weapon.range) {
        mode.range = calculateWeaponStat(
          "range",
          weapon.range,
          mods,
          showMaxStacks
        );
      }

      attackModes.push(mode);
    }
  }

  return {
    attackModes,
    multishot,
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

  // Round both base and modified to avoid floating point comparison issues
  const roundedBase = Math.round(baseValue * 100) / 100;
  const roundedModified = Math.round(modified * 100) / 100;

  // Calculate percent of bonus
  const totalBonus = roundedModified - roundedBase;
  if (Math.abs(totalBonus) > 0.001) {
    for (const contrib of contributions) {
      contrib.percentOfBonus =
        (Math.abs(contrib.absoluteValue) / Math.abs(totalBonus)) * 100;
    }
  }

  return {
    base: roundedBase,
    modified: roundedModified,
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
    physical.impact = Math.round(
      baseDamage.impact *
        baseDamageMultiplier *
        getPhysicalMultiplier("impact", mods, showMaxStacks)
    );
  }
  if (baseDamage.puncture) {
    physical.puncture = Math.round(
      baseDamage.puncture *
        baseDamageMultiplier *
        getPhysicalMultiplier("puncture", mods, showMaxStacks)
    );
  }
  if (baseDamage.slash) {
    physical.slash = Math.round(
      baseDamage.slash *
        baseDamageMultiplier *
        getPhysicalMultiplier("slash", mods, showMaxStacks)
    );
  }

  // Calculate total modded base damage (for elemental calculation)
  const totalModdedBase =
    (physical.impact ?? 0) + (physical.puncture ?? 0) + (physical.slash ?? 0);

  // Collect elemental mods in order
  const elementalMods: { type: DamageType; value: number; modName: string }[] =
    [];

  for (const mod of mods) {
    const parsedStats = parseModStats(mod);
    for (const stat of parsedStats) {
      if (
        BASE_ELEMENTS.includes(stat.type as DamageType) &&
        stat.operation === "percent_add"
      ) {
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
      const combinedType =
        ELEMENTAL_COMBINATIONS[`${first.type}+${second.type}`];

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
