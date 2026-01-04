# SPEC: Advanced Calculations System

## Overview

This specification describes advanced calculation features beyond basic stat display, including:
- Effective Health Pool (EHP) calculations
- Damage Per Second (DPS) calculations
- Time-To-Kill (TTK) estimates
- Build comparisons
- Stat optimization suggestions

**Prerequisites**: This spec assumes [SPEC-STATS-CALCULATION.md](./SPEC-STATS-CALCULATION.md) is implemented.

## Problem Statement

While basic stat display helps users understand their build, it doesn't answer key questions:
- "How tanky is my Warframe against Grineer?"
- "What's my actual DPS against a level 100 Heavy Gunner?"
- "Is Viral or Corrosive better for this build?"
- "How much damage am I losing by not using a Riven?"

These calculations require understanding Warframe's damage formulas, enemy armor/health scaling, and status effect interactions.

## Goals

1. **EHP Display**: Show effective survivability against different factions
2. **DPS Calculator**: Calculate theoretical and practical DPS
3. **Enemy Simulation**: Show TTK against specific enemy types
4. **Build Comparison**: Compare two builds side-by-side
5. **Optimization Hints**: Suggest mod improvements

## Technical Design

### 1. Effective Health Pool (EHP)

EHP represents how much raw damage a Warframe can take before dying.

#### Formula
```
EHP = Health × (1 + Armor/300) × (1 / (1 - DamageReduction))
```

Where:
- `Health` = Modified health from mods/shards
- `Armor` = Modified armor
- `DamageReduction` = From abilities, Adaptation, etc.

#### Implementation

```typescript
// src/lib/warframe/ehp-calculator.ts

interface EHPResult {
  base: number;                    // Raw health + shields
  withArmor: number;              // EHP against physical damage
  againstFaction: {
    grineer: number;              // Heavy on IPS, some elemental
    corpus: number;               // Shield bypass, magnetic
    infested: number;             // Mostly toxic, slash
    corrupted: number;            // Mixed
  };
  breakdown: {
    healthContribution: number;
    shieldContribution: number;
    armorMultiplier: number;
    adaptationMax: number;        // If equipped
  };
}

function calculateEHP(
  stats: CalculatedStats["warframe"],
  equippedMods: PlacedMod[]
): EHPResult {
  const health = stats.health.modified;
  const shield = stats.shield.modified;
  const armor = stats.armor.modified;

  // Base EHP (no armor)
  const baseEHP = health + shield;

  // Armor damage reduction formula
  const armorDR = armor / (armor + 300);
  const armorMultiplier = 1 / (1 - armorDR);

  // EHP with armor (armor only protects health, not shields)
  const ehpWithArmor = (health * armorMultiplier) + shield;

  // Check for Adaptation mod
  const hasAdaptation = equippedMods.some(m => m.name === "Adaptation");
  const adaptationMax = hasAdaptation ? ehpWithArmor * (1 / 0.1) : ehpWithArmor;

  return {
    base: baseEHP,
    withArmor: ehpWithArmor,
    againstFaction: {
      grineer: ehpWithArmor * 1.0,     // Armor effective
      corpus: baseEHP * 1.2,           // Shield damage types common
      infested: ehpWithArmor * 0.9,    // Slash/toxic bypass armor
      corrupted: ehpWithArmor * 1.0,   // Mixed
    },
    breakdown: {
      healthContribution: health,
      shieldContribution: shield,
      armorMultiplier,
      adaptationMax,
    },
  };
}
```

### 2. Damage Per Second (DPS)

#### Weapon DPS Formula

```
Base DPS = (Modded Damage × Multishot × Fire Rate) × Crit Multiplier
Sustained DPS = Base DPS × (Magazine / (Magazine + Reload × Fire Rate))
```

Where Critical Multiplier:
```
Crit Multiplier = 1 + (CritChance × (CritMultiplier - 1))

// For crit chance > 100%:
Tier = floor(CritChance / 100)
Remainder = CritChance % 100
Crit Multiplier = 1 + (Tier × (CritMultiplier - 1)) + (Remainder × (CritMultiplier - 1))
```

#### Implementation

```typescript
// src/lib/warframe/dps-calculator.ts

interface DPSResult {
  burst: number;                   // Instantaneous DPS
  sustained: number;               // Accounting for reloads
  perShot: number;                 // Damage per trigger pull
  perSecond: number;              // Shots per second
  critTier: {
    tier: number;                  // Orange crit = 2, red = 3
    average: number;               // Average crit multiplier
  };
  damageByType: Record<DamageType, number>;
  statusPerSecond: Record<DamageType, number>;
}

interface DPSOptions {
  headshots?: boolean;             // 2x multiplier for headshots
  factionBonus?: FactionType;      // Bane mod bonus
  conditionMet?: boolean;          // Galvanized stacks, etc.
}

function calculateDPS(
  stats: CalculatedStats["weapon"],
  options: DPSOptions = {}
): DPSResult {
  const {
    totalDamage,
    criticalChance,
    criticalMultiplier,
    fireRate,
    multishot,
    magazineSize,
    reloadTime,
  } = stats;

  // Calculate average crit multiplier
  const critChance = criticalChance.modified;
  const critMult = criticalMultiplier.modified;
  const critTier = Math.floor(critChance);
  const critRemainder = critChance - critTier;
  const avgCritMult = 1 + (critTier * (critMult - 1)) + (critRemainder * (critMult - 1));

  // Per-shot damage
  const damagePerShot = totalDamage.modified * multishot.modified * avgCritMult;

  // Headshot multiplier
  const headshotMult = options.headshots ? 2 : 1;

  // Burst DPS
  const burstDPS = damagePerShot * fireRate.modified * headshotMult;

  // Sustained DPS (accounting for reloads)
  const magSize = magazineSize?.modified ?? Infinity;
  const reload = reloadTime?.modified ?? 0;
  const sustainedMult = reload > 0
    ? magSize / (magSize + reload * fireRate.modified)
    : 1;
  const sustainedDPS = burstDPS * sustainedMult;

  return {
    burst: burstDPS,
    sustained: sustainedDPS,
    perShot: damagePerShot,
    perSecond: fireRate.modified,
    critTier: {
      tier: critTier,
      average: avgCritMult,
    },
    damageByType: stats.damageBreakdown,
    statusPerSecond: calculateStatusPerSecond(stats),
  };
}
```

### 3. Enemy Damage Simulation

#### Enemy Scaling

Warframe enemies scale with level. Key formulas:

```
// Grineer armor scaling
Armor(level) = BaseArmor × (1 + (level - BaseLevel)^1.75 × 0.005)

// Health scaling (all factions)
Health(level) = BaseHealth × (1 + (level - BaseLevel)^2 × 0.015)

// Shield scaling (Corpus)
Shield(level) = BaseShield × (1 + (level - BaseLevel)^2 × 0.0075)
```

#### Armor Damage Reduction

```
Damage Reduction = Armor / (Armor + 300)
Damage Taken = Damage × (1 - Damage Reduction)
```

#### Time to Kill Calculator

```typescript
// src/lib/warframe/ttk-calculator.ts

interface Enemy {
  name: string;
  baseLevel: number;
  baseHealth: number;
  baseArmor: number;
  baseShield: number;
  healthType: "flesh" | "cloned_flesh" | "robotic" | "infested" | "fossilized";
  armorType: "ferrite" | "alloy" | "none";
  shieldType: "proto" | "standard" | "none";
}

interface TTKResult {
  timeToKill: number;             // Seconds
  shotsToKill: number;
  effectiveDamage: number;        // After armor/resistances
  statusDamage: number;           // DOT contribution
  optimalElement: DamageType;     // Best damage type for this enemy
}

const COMMON_ENEMIES: Enemy[] = [
  {
    name: "Heavy Gunner",
    baseLevel: 1,
    baseHealth: 300,
    baseArmor: 500,
    baseShield: 0,
    healthType: "cloned_flesh",
    armorType: "alloy",
    shieldType: "none",
  },
  {
    name: "Corrupted Heavy Gunner",
    baseLevel: 1,
    baseHealth: 700,
    baseArmor: 500,
    baseShield: 0,
    healthType: "cloned_flesh",
    armorType: "ferrite",
    shieldType: "none",
  },
  {
    name: "Corpus Tech",
    baseLevel: 1,
    baseHealth: 60,
    baseArmor: 0,
    baseShield: 250,
    healthType: "flesh",
    armorType: "none",
    shieldType: "proto",
  },
  // ... more enemies
];

function calculateTTK(
  dps: DPSResult,
  enemy: Enemy,
  level: number
): TTKResult {
  // Scale enemy stats
  const levelDiff = level - enemy.baseLevel;
  const scaledHealth = enemy.baseHealth * (1 + Math.pow(levelDiff, 2) * 0.015);
  const scaledArmor = enemy.baseArmor * (1 + Math.pow(levelDiff, 1.75) * 0.005);
  const scaledShield = enemy.baseShield * (1 + Math.pow(levelDiff, 2) * 0.0075);

  // Calculate damage type effectiveness
  const typeModifiers = getDamageTypeModifiers(
    enemy.healthType,
    enemy.armorType,
    enemy.shieldType
  );

  // Apply armor reduction
  const armorDR = scaledArmor / (scaledArmor + 300);
  const effectiveMultiplier = 1 - armorDR;

  // Calculate effective DPS against this enemy
  let effectiveDPS = 0;
  for (const [type, damage] of Object.entries(dps.damageByType)) {
    const modifier = typeModifiers[type as DamageType] ?? 1;
    effectiveDPS += damage * modifier * effectiveMultiplier;
  }
  effectiveDPS *= dps.perSecond;

  // Calculate TTK
  const totalEHP = scaledHealth + scaledShield;
  const ttk = totalEHP / effectiveDPS;

  return {
    timeToKill: ttk,
    shotsToKill: Math.ceil(ttk * dps.perSecond),
    effectiveDamage: effectiveDPS,
    statusDamage: 0, // TODO: Calculate DOT
    optimalElement: findOptimalElement(enemy),
  };
}
```

### 4. Damage Type Modifiers

```typescript
// src/lib/warframe/damage-types.ts

type HealthType = "flesh" | "cloned_flesh" | "robotic" | "infested" |
                  "fossilized" | "sinew" | "infested_flesh" | "object";
type ArmorType = "ferrite" | "alloy" | "none";
type ShieldType = "proto" | "standard" | "none";

const HEALTH_MODIFIERS: Record<HealthType, Partial<Record<DamageType, number>>> = {
  flesh: {
    impact: 0.75, slash: 1.25, toxin: 1.5, viral: 1.5, gas: 0.75,
  },
  cloned_flesh: {
    impact: 0.75, slash: 1.25, heat: 1.25, viral: 1.75, gas: 0.5,
  },
  robotic: {
    puncture: 1.25, electricity: 1.5, radiation: 1.25, toxin: 0.75,
  },
  infested: {
    slash: 1.25, heat: 1.25, gas: 1.75, radiation: 0.5,
  },
  fossilized: {
    slash: 1.15, cold: 0.75, corrosive: 1.75, blast: 1.5, radiation: 0.25,
  },
  // ... more
};

const ARMOR_MODIFIERS: Record<ArmorType, Partial<Record<DamageType, number>>> = {
  ferrite: {
    puncture: 1.5, corrosive: 1.75, slash: 0.85, blast: 0.75,
  },
  alloy: {
    puncture: 1.15, cold: 1.25, radiation: 1.75, slash: 0.5, electricity: 0.5, magnetic: 0.5,
  },
  none: {},
};

function getDamageTypeModifiers(
  healthType: HealthType,
  armorType: ArmorType,
  shieldType: ShieldType
): Record<DamageType, number> {
  const modifiers: Record<DamageType, number> = {};

  // Combine all modifiers multiplicatively
  for (const type of ALL_DAMAGE_TYPES) {
    const healthMod = HEALTH_MODIFIERS[healthType]?.[type] ?? 1;
    const armorMod = ARMOR_MODIFIERS[armorType]?.[type] ?? 1;
    const shieldMod = SHIELD_MODIFIERS[shieldType]?.[type] ?? 1;
    modifiers[type] = healthMod * armorMod * shieldMod;
  }

  return modifiers;
}
```

### 5. Build Comparison System

```typescript
// src/lib/warframe/build-comparison.ts

interface BuildComparison {
  stats: Array<{
    label: string;
    build1: number | string;
    build2: number | string;
    difference: number;      // Percentage change
    winner: 1 | 2 | "tie";
  }>;
  summary: {
    build1Advantages: string[];
    build2Advantages: string[];
    recommendation: string;
  };
}

function compareBuildStats(
  build1: CalculatedStats,
  build2: CalculatedStats
): BuildComparison {
  const stats: BuildComparison["stats"] = [];

  // Compare key stats
  if (build1.warframe && build2.warframe) {
    stats.push(
      compareValue("Health", build1.warframe.health, build2.warframe.health),
      compareValue("Armor", build1.warframe.armor, build2.warframe.armor),
      compareValue("Ability Strength", build1.warframe.abilityStrength, build2.warframe.abilityStrength),
      // ... more stats
    );
  }

  if (build1.weapon && build2.weapon) {
    stats.push(
      compareValue("Burst DPS", calculateDPS(build1.weapon), calculateDPS(build2.weapon)),
      // ... more stats
    );
  }

  return {
    stats,
    summary: generateSummary(stats),
  };
}
```

### 6. Optimization Suggestions

```typescript
// src/lib/warframe/build-optimizer.ts

interface OptimizationSuggestion {
  type: "replace_mod" | "add_mod" | "change_rank" | "add_forma";
  priority: "high" | "medium" | "low";
  description: string;
  impact: string;  // e.g., "+15% DPS", "+500 EHP"
  currentMod?: PlacedMod;
  suggestedMod?: Mod;
}

function analyzeWarframeBuild(
  buildState: BuildState,
  stats: CalculatedStats
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Check for missing essential mods
  const equippedMods = getAllEquippedMods(buildState);

  // Health/survivability check
  if (stats.warframe?.health.modified < 1000) {
    suggestions.push({
      type: "add_mod",
      priority: "high",
      description: "Consider adding Vitality for survivability",
      impact: "+440 Health",
      suggestedMod: findMod("Vitality"),
    });
  }

  // Ability build detection
  if (hasAbilityMods(equippedMods)) {
    if (!hasMod(equippedMods, "Intensify") && !hasMod(equippedMods, "Umbral Intensify")) {
      suggestions.push({
        type: "add_mod",
        priority: "medium",
        description: "Add Intensify for ability damage",
        impact: "+30% Ability Strength",
      });
    }
  }

  // Synergy detection
  if (hasMultipleUmbrals(equippedMods)) {
    const umbralCount = countUmbrals(equippedMods);
    if (umbralCount === 2) {
      suggestions.push({
        type: "add_mod",
        priority: "medium",
        description: "Add third Umbral mod for maximum set bonus",
        impact: "+75% to all Umbral stats",
      });
    }
  }

  return suggestions;
}

function analyzeWeaponBuild(
  buildState: BuildState,
  stats: CalculatedStats
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Check for missing damage mod
  if (!hasDamageMod(buildState)) {
    suggestions.push({
      type: "add_mod",
      priority: "high",
      description: "Add base damage mod (Serration, Hornet Strike, etc.)",
      impact: "+165% Damage",
    });
  }

  // Check for multishot
  if (!hasMultishotMod(buildState)) {
    suggestions.push({
      type: "add_mod",
      priority: "high",
      description: "Add multishot mod (Split Chamber, Barrel Diffusion)",
      impact: "+90% effective damage",
    });
  }

  // Element optimization
  const optimalElement = findOptimalElementForFaction("grineer");
  if (!hasElement(buildState, optimalElement)) {
    suggestions.push({
      type: "add_mod",
      priority: "medium",
      description: `Consider ${optimalElement} for Grineer content`,
      impact: "Better armor stripping",
    });
  }

  return suggestions;
}
```

### 7. UI Components

#### Advanced Stats Panel

```tsx
// src/components/build-editor/advanced-stats-panel.tsx

interface AdvancedStatsPanelProps {
  buildState: BuildState;
  calculatedStats: CalculatedStats;
  onCompare?: () => void;
}

function AdvancedStatsPanel({ buildState, calculatedStats }: AdvancedStatsPanelProps) {
  const [selectedEnemy, setSelectedEnemy] = useState<Enemy>(COMMON_ENEMIES[0]);
  const [enemyLevel, setEnemyLevel] = useState(100);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const ehp = useMemo(
    () => calculateEHP(calculatedStats.warframe, getAllMods(buildState)),
    [calculatedStats, buildState]
  );

  const dps = useMemo(
    () => calculatedStats.weapon ? calculateDPS(calculatedStats.weapon) : null,
    [calculatedStats]
  );

  const ttk = useMemo(
    () => dps ? calculateTTK(dps, selectedEnemy, enemyLevel) : null,
    [dps, selectedEnemy, enemyLevel]
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold">Advanced Stats</h3>

      {/* EHP Section */}
      {ehp && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Effective Health</span>
            <span className="font-mono">{formatNumber(ehp.withArmor)}</span>
          </div>
          {showBreakdown && (
            <div className="text-xs text-muted-foreground pl-4 space-y-1">
              <div>Health: {ehp.breakdown.healthContribution}</div>
              <div>Shield: {ehp.breakdown.shieldContribution}</div>
              <div>Armor Multiplier: {ehp.breakdown.armorMultiplier.toFixed(2)}x</div>
            </div>
          )}
        </div>
      )}

      {/* DPS Section */}
      {dps && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Burst DPS</span>
            <span className="font-mono">{formatNumber(dps.burst)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Sustained DPS</span>
            <span className="font-mono">{formatNumber(dps.sustained)}</span>
          </div>
        </div>
      )}

      {/* TTK Section */}
      {ttk && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span>TTK vs</span>
            <Select value={selectedEnemy.name} onValueChange={handleEnemyChange}>
              {COMMON_ENEMIES.map(e => (
                <SelectItem key={e.name} value={e.name}>{e.name}</SelectItem>
              ))}
            </Select>
            <span>Lv.</span>
            <Input
              type="number"
              value={enemyLevel}
              onChange={e => setEnemyLevel(Number(e.target.value))}
              className="w-16"
            />
          </div>
          <div className="flex justify-between text-sm">
            <span>Time to Kill</span>
            <span className="font-mono">{ttk.timeToKill.toFixed(2)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Build Comparison Modal

```tsx
// src/components/build-editor/build-comparison-modal.tsx

interface BuildComparisonModalProps {
  open: boolean;
  onClose: () => void;
  currentBuild: BuildState;
  compareBuild?: BuildState;
}

function BuildComparisonModal({ open, onClose, currentBuild, compareBuild }: BuildComparisonModalProps) {
  const [importedBuild, setImportedBuild] = useState<BuildState | null>(compareBuild ?? null);

  const comparison = useMemo(() => {
    if (!importedBuild) return null;
    const stats1 = calculateStats(getItem(currentBuild), currentBuild);
    const stats2 = calculateStats(getItem(importedBuild), importedBuild);
    return compareBuildStats(stats1, stats2);
  }, [currentBuild, importedBuild]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compare Builds</DialogTitle>
        </DialogHeader>

        {!importedBuild && (
          <div className="space-y-4">
            <p>Paste a build code to compare:</p>
            <Input
              placeholder="Build code..."
              onChange={e => handleImport(e.target.value)}
            />
          </div>
        )}

        {comparison && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stat</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Compare</TableHead>
                <TableHead>Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.stats.map(stat => (
                <TableRow key={stat.label}>
                  <TableCell>{stat.label}</TableCell>
                  <TableCell className={stat.winner === 1 ? "text-green-500" : ""}>
                    {stat.build1}
                  </TableCell>
                  <TableCell className={stat.winner === 2 ? "text-green-500" : ""}>
                    {stat.build2}
                  </TableCell>
                  <TableCell className={stat.difference > 0 ? "text-green-500" : "text-red-500"}>
                    {stat.difference > 0 ? "+" : ""}{stat.difference.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

## Implementation Plan

### Phase 1: Core Calculations
1. Implement EHP calculator with armor formula
2. Implement DPS calculator with crit averaging
3. Add damage type modifier tables
4. Create calculation result types

### Phase 2: Enemy System
1. Add common enemy database with stats
2. Implement enemy level scaling formulas
3. Create TTK calculator
4. Add faction-specific recommendations

### Phase 3: UI Components
1. Create AdvancedStatsPanel component
2. Add EHP display with breakdown toggle
3. Add DPS display with weapon stats
4. Add TTK simulator with enemy selector

### Phase 4: Build Comparison
1. Implement build comparison logic
2. Create BuildComparisonModal
3. Add build import functionality
4. Generate comparison summaries

### Phase 5: Optimization Engine
1. Implement suggestion analysis
2. Add essential mod detection
3. Add synergy detection (sets, combos)
4. Create suggestion UI component

### Phase 6: Polish
1. Add calculation caching/memoization
2. Performance optimization
3. Add export/share comparison results
4. Add calculation explanations/tooltips

## File Structure

```
src/lib/warframe/
├── ehp-calculator.ts           # EHP calculations
├── dps-calculator.ts           # DPS calculations
├── ttk-calculator.ts           # Time-to-kill simulator
├── damage-types.ts             # Damage type modifiers
├── enemy-database.ts           # Common enemy stats
├── build-comparison.ts         # Comparison logic
├── build-optimizer.ts          # Optimization suggestions
└── scaling-formulas.ts         # Enemy scaling math

src/components/build-editor/
├── advanced-stats-panel.tsx    # Main advanced stats UI
├── ehp-display.tsx             # EHP widget
├── dps-display.tsx             # DPS widget
├── ttk-simulator.tsx           # TTK calculator UI
├── build-comparison-modal.tsx  # Comparison dialog
└── optimization-panel.tsx      # Suggestions UI
```

## Data Sources

### Enemy Data
- Primary source: [Warframe Wiki](https://wiki.warframe.com)
- Alternative: DE's official data (when available)
- Community sources: [WFCD](https://github.com/WFCD)

### Scaling Formulas
- [Warframe Wiki: Enemy Level Scaling](https://wiki.warframe.com/w/Enemy_Level_Scaling)
- [Warframe Wiki: Damage](https://wiki.warframe.com/w/Damage)
- [Warframe Wiki: Armor](https://wiki.warframe.com/w/Armor)

## Testing Strategy

1. **Unit tests** for all calculators with known values
2. **Reference tests** comparing against Warframe wiki examples
3. **Snapshot tests** for UI components
4. **Integration tests** with real mod combinations

### Example Test Cases

```typescript
describe("EHP Calculator", () => {
  it("calculates base Rhino EHP correctly", () => {
    const stats = {
      health: { base: 300, modified: 740 },  // With Vitality
      shield: { base: 450, modified: 450 },
      armor: { base: 190, modified: 665 },   // With Steel Fiber
    };
    const ehp = calculateEHP(stats, []);
    expect(ehp.withArmor).toBeCloseTo(2401, 0);  // Known value
  });
});

describe("DPS Calculator", () => {
  it("calculates Braton Prime DPS with serration", () => {
    const stats = createWeaponStats("Braton Prime", [
      { name: "Serration", rank: 10 },
    ]);
    const dps = calculateDPS(stats);
    expect(dps.burst).toBeCloseTo(1534, 0);  // Known value
  });
});
```

## Open Questions

1. **Status effect simulation**: How detailed should DOT calculations be?
   - Proposal: Show total status procs/second, defer full simulation

2. **Melee combo counter**: Include in DPS calculations?
   - Proposal: Show DPS at different combo multipliers (1x, 3x, 12x)

3. **Arcane triggers**: How to handle conditional arcane bonuses?
   - Proposal: Show "with Arcane active" as separate stat line

4. **Build saving**: Should comparisons save build snapshots?
   - Proposal: Yes, store as build codes in localStorage

## Success Metrics

- EHP calculations within 1% of wiki values
- DPS calculations within 5% of in-game testing
- TTK estimates within 10% of actual gameplay
- No calculation errors for common builds
- UI remains responsive with complex calculations

## Future Enhancements

1. **Damage resistance stacking** (Adaptation, DR abilities)
2. **Companion contribution** to DPS/survivability
3. **Mission scenario simulation** (Survival time, wave defense)
4. **Riven disposition integration**
5. **Elemental combination optimization**
6. **Build recommendations by mission type**
