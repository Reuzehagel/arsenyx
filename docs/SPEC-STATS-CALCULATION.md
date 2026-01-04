# SPEC: Real-Time Stats Calculation System

## Overview

This specification describes the system for updating warframe and weapon stats in real-time as mods are placed, removed, or modified in the build editor.

## Problem Statement

Currently, the `ItemSidebar` component displays **static base stats** from the item data. When users place mods like Vitality (+100% Health) or Serration (+165% Damage), the displayed stats do not update. Users cannot see the impact of their mod choices without external tools.

### Current State

```
src/components/build-editor/item-sidebar.tsx:229-253
- Warframe stats (health, shield, armor, energy, sprint speed) are displayed from `itemStats`
- These values are read-only base values from the item JSON data
- No calculation is performed based on equipped mods
```

**Ability Stats Section (lines 306-328)** shows hardcoded 100% values:
```tsx
<StatRow label="Duration" value="100%" />
<StatRow label="Efficiency" value="100%" />
<StatRow label="Range" value="100%" />
<StatRow label="Strength" value="100%" />
```

## Goals

1. **Real-time stat updates**: Stats reflect placed mods immediately
2. **Visual feedback**: Show base vs modified values (e.g., "740 → 1480")
3. **Accurate calculations**: Match in-game formulas
4. **Extensibility**: Support shards, arcanes, and set bonuses
5. **Performance**: Calculations must not cause UI lag

## Technical Design

### 1. Stat Parser Module

Create `src/lib/warframe/stat-parser.ts` to parse mod stat strings:

```typescript
// Input: "+100% Health", "+165% Damage", "+30% Ability Strength"
// Output: { type: "health", value: 100, operation: "percent_add" }

interface ParsedStat {
  type: StatType;
  value: number;
  operation: "flat_add" | "percent_add" | "percent_mult";
  damageType?: DamageType; // For elemental mods
}

type StatType =
  // Warframe stats
  | "health" | "shield" | "armor" | "energy" | "sprint_speed"
  | "ability_strength" | "ability_duration" | "ability_efficiency" | "ability_range"
  // Weapon stats
  | "damage" | "critical_chance" | "critical_multiplier" | "status_chance"
  | "fire_rate" | "magazine_size" | "reload_speed" | "multishot"
  | "punch_through" | "range"
  // Damage types
  | "impact" | "puncture" | "slash"
  | "heat" | "cold" | "electricity" | "toxin"
  | "blast" | "radiation" | "gas" | "magnetic" | "viral" | "corrosive";

function parseModStat(statString: string): ParsedStat | null;
function parseModStats(mod: PlacedMod): ParsedStat[];
```

### 2. Stat Patterns to Parse

Based on WFCD mod data analysis:

| Pattern | Example | Parsed Result |
|---------|---------|---------------|
| `+{n}% {stat}` | `+100% Health` | `{ type: "health", value: 100, operation: "percent_add" }` |
| `+{n} {stat}` | `+300 Armor` | `{ type: "armor", value: 300, operation: "flat_add" }` |
| `+{n}% <DT_X_COLOR>{Type}` | `+90% <DT_HEAT_COLOR>Heat` | `{ type: "heat", value: 90, operation: "percent_add" }` |
| `-{n}% {stat}` | `-50% Recoil` | `{ type: "recoil", value: -50, operation: "percent_add" }` |
| `{n}x {stat}` | `2.5x Combo Duration` | `{ type: "combo_duration", value: 2.5, operation: "percent_mult" }` |

### 3. Calculation Engine

Create `src/lib/warframe/stats-calculator.ts`:

```typescript
interface CalculatedStats {
  // Warframe
  warframe?: {
    health: { base: number; modified: number };
    shield: { base: number; modified: number };
    armor: { base: number; modified: number };
    energy: { base: number; modified: number };
    sprintSpeed: { base: number; modified: number };
    abilityStrength: { base: number; modified: number };
    abilityDuration: { base: number; modified: number };
    abilityEfficiency: { base: number; modified: number };
    abilityRange: { base: number; modified: number };
  };

  // Weapons
  weapon?: {
    totalDamage: { base: number; modified: number };
    criticalChance: { base: number; modified: number };
    criticalMultiplier: { base: number; modified: number };
    statusChance: { base: number; modified: number };
    fireRate: { base: number; modified: number };
    multishot: { base: number; modified: number };
    magazineSize?: { base: number; modified: number };
    reloadTime?: { base: number; modified: number };
    range?: { base: number; modified: number };
    damageBreakdown: Record<DamageType, number>;
  };
}

function calculateStats(
  item: BrowseableItem,
  buildState: BuildState
): CalculatedStats;
```

### 4. Calculation Order (Critical)

Warframe's mod system applies bonuses in a specific order:

#### Warframe Stat Order:
1. **Base stat** (from item data)
2. **Flat additions** (rare, e.g., Umbral Vitality has flat bonus)
3. **Percentage additions** (most mods, stack additively)
4. **Set bonuses** (Umbral set multiplier)
5. **Archon Shards** (additive with mods)

```
Final Health = (Base + FlatBonus) × (1 + ∑PercentBonuses + ShardBonuses) × SetMultiplier
```

#### Weapon Damage Order:
1. **Base damage** (from attacks array or totalDamage)
2. **Base damage mods** (Serration, Hornet Strike) - additive
3. **Multishot** (Split Chamber) - separate multiplier
4. **Elemental damage** - calculated from modded base
5. **Critical** - separate calculation

```
Modded Base = Base × (1 + ∑BaseDamageMods)
Avg Damage = Modded Base × (1 + Multishot) × CritMultiplier
```

### 5. Umbral Set Bonus Handling

From `src/lib/warframe/mod-variants.ts`, Umbral mods have special set scaling:

```typescript
const UMBRAL_MULTIPLIERS = {
  "Umbral Intensify": { at2: 1.25, at3: 1.75 },
  "Umbral Vitality": { at2: 1.30, at3: 1.80 },
  "Umbral Fiber": { at2: 1.30, at3: 1.80 },
};

function getUmbralMultiplier(modName: string, equippedCount: number): number {
  if (equippedCount < 2) return 1;
  const multipliers = UMBRAL_MULTIPLIERS[modName];
  return equippedCount >= 3 ? multipliers.at3 : multipliers.at2;
}
```

### 6. Archon Shard Integration

Shards from `src/lib/warframe/shards.ts` provide additional bonuses:

```typescript
// Shard bonuses are additive with mod percentages
function getShardBonuses(shardSlots: (PlacedShard | null)[]): Record<string, number> {
  const bonuses: Record<string, number> = {};

  for (const shard of shardSlots) {
    if (!shard) continue;
    const stat = findStat(shard.color, shard.stat);
    if (!stat) continue;

    const value = shard.tauforged ? stat.tauforgedValue : stat.baseValue;
    bonuses[shard.stat] = (bonuses[shard.stat] ?? 0) + value;
  }

  return bonuses;
}
```

### 7. UI Component Updates

#### Modified StatRow Component

```tsx
interface StatRowProps {
  label: string;
  base: number | string;
  modified?: number | string;
  unit?: string;
  format?: "number" | "percent" | "decimal";
}

function StatRow({ label, base, modified, unit = "", format = "number" }: StatRowProps) {
  const hasChange = modified !== undefined && modified !== base;

  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {hasChange ? (
          <>
            <span className="text-muted-foreground line-through mr-1">
              {formatValue(base, format)}{unit}
            </span>
            <span className={modified > base ? "text-green-500" : "text-red-500"}>
              {formatValue(modified, format)}{unit}
            </span>
          </>
        ) : (
          `${formatValue(base, format)}${unit}`
        )}
      </span>
    </div>
  );
}
```

#### ItemSidebar Integration

```tsx
function ItemSidebar({ buildState, itemStats, ... }: ItemSidebarProps) {
  // Calculate stats based on current build
  const calculatedStats = useMemo(
    () => calculateStats(itemData, buildState),
    [itemData, buildState]
  );

  return (
    // ... existing JSX
    <StatRow
      label="Health"
      base={calculatedStats.warframe?.health.base ?? 0}
      modified={calculatedStats.warframe?.health.modified}
    />
  );
}
```

### 8. Performance Considerations

1. **Memoization**: Use `useMemo` to cache calculations
2. **Selective recalculation**: Only recalculate when mods/shards change
3. **Debouncing**: Debounce rapid mod rank changes (keyboard +/-)
4. **Lazy parsing**: Parse mod stats once and cache

```typescript
// Cache parsed mod stats
const modStatsCache = new Map<string, ParsedStat[]>();

function getModStats(mod: PlacedMod): ParsedStat[] {
  const cacheKey = `${mod.uniqueName}:${mod.rank}`;
  if (modStatsCache.has(cacheKey)) {
    return modStatsCache.get(cacheKey)!;
  }
  const stats = parseModStats(mod);
  modStatsCache.set(cacheKey, stats);
  return stats;
}
```

## Implementation Plan

### Phase 1: Core Parser & Calculator
1. Create `src/lib/warframe/stat-parser.ts` with regex-based stat parsing
2. Create `src/lib/warframe/stats-calculator.ts` with base calculation logic
3. Add unit tests for common mod patterns
4. Handle edge cases (negative values, multiplicative bonuses)

### Phase 2: Warframe Stats
1. Implement health/shield/armor/energy calculations
2. Implement ability stat calculations (strength/duration/efficiency/range)
3. Add Umbral set bonus handling
4. Integrate Archon Shard bonuses

### Phase 3: Weapon Stats
1. Implement base damage calculations
2. Implement critical chance/multiplier calculations
3. Implement status chance calculations
4. Add elemental damage type breakdown
5. Handle multishot calculations

### Phase 4: UI Integration
1. Update `StatRow` component for base/modified display
2. Update `ItemSidebar` to use calculated stats
3. Add color coding for improvements/reductions
4. Add hover tooltips showing calculation breakdown

### Phase 5: Polish & Edge Cases
1. Handle Galvanized mod stacking (on-kill bonuses shown as "at max stacks")
2. Handle conditional bonuses (show as separate line)
3. Add arcane stat bonuses (when at rank 5)
4. Performance optimization and testing

## File Structure

```
src/lib/warframe/
├── stat-parser.ts          # Parse mod stat strings
├── stats-calculator.ts     # Main calculation engine
├── stat-types.ts           # Type definitions
├── stat-patterns.ts        # Regex patterns for parsing
├── umbral-set.ts          # Umbral set bonus logic
└── index.ts               # Updated exports

src/components/build-editor/
├── item-sidebar.tsx       # Updated with calculated stats
├── stat-row.tsx           # New: stat display component
└── stats-breakdown.tsx    # New: detailed breakdown tooltip
```

## Testing Strategy

1. **Unit tests** for stat parser with all known patterns
2. **Unit tests** for calculator with known mod combinations
3. **Snapshot tests** for UI components
4. **Integration tests** comparing output to Warframe wiki values

## Open Questions

1. **Conditional mods**: How to display mods like "While Aiming" or "On Kill"?
   - Proposal: Show base value with "+X on condition" annotation

2. **Rivens**: Should we support Riven mods with random stats?
   - Proposal: Defer to Phase 6, requires additional UI for stat entry

3. **Companion mods**: Do companion mods affect warframe stats?
   - Answer: Some do (Link mods). Include in Phase 5.

4. **Exalted weapons**: How to handle pseudo-exalted weapons inheriting mods?
   - Proposal: Separate build section, defer to future work

## Success Metrics

- Stats update within 16ms (one frame) of mod placement
- 100% accuracy for common mod combinations
- No visual jank or layout shift during updates

## References

- [Warframe Wiki: Damage](https://wiki.warframe.com/w/Damage)
- [Warframe Wiki: Armor](https://wiki.warframe.com/w/Armor)
- [WFCD Items Package](https://github.com/WFCD/warframe-items)
- Existing: `src/lib/warframe/capacity.ts` (drain calculations)
- Existing: `src/lib/warframe/shards.ts` (shard data)
