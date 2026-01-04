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

1. **Real-time stat updates**: Stats reflect placed mods immediately (on drop, not during drag)
2. **Visual feedback**: Show modified values with breakdown on hover
3. **Accurate calculations**: Match in-game formulas with proper stat caps
4. **Per-mod contribution tracking**: Show which mods/shards contribute to each stat
5. **Performance**: Calculations must not cause UI lag (<16ms)

## Design Decisions (from stakeholder interview)

### Data & Parsing
- **Data source priority**: Use WFCD `levelStats` structured data first, fall back to string parsing only for mods missing structured data
- **Mod variants**: Trust WFCD structured data to handle Primed/Umbral differences
- **Localization**: English-only for MVP
- **Caching**: No caching initially; add formula-based caching only if profiling shows performance issues

### Calculation Behavior
- **Stat caps**: Show both capped and uncapped values (e.g., "200% (capped: 175%)") to highlight wasted stats
- **Conditional/stacking mods**: Toggle to switch between base stats and "at max stacks" values
- **Aura effects**: Include self-affecting auras (Physique, Steel Charge) but exclude squad/enemy effects (Corrosive Projection)
- **Warframe passives**: Out of scope for MVP - only mod effects are calculated
- **Combo/stance multipliers**: Out of scope - basic stats only, advanced DPS tool deferred to future work

### UI/UX
- **Multi-stat mods**: Use neutral color for mixed-effect mods (like Blind Rage), positive in green, negative in red
- **Stats layout**: Always visible (no collapsible sections)
- **Display format**: Show final modified value only, with color indicating increase (green) or decrease (red)
- **Empty build**: Show base value only (no arrow notation when unchanged)
- **Decimal precision**: Smart rounding - minimum decimals needed, no trailing zeros
- **Update timing**: Stats update on mod drop only (not during drag preview)
- **Tooltip trigger**: Hover over stat value to see step-by-step breakdown
- **Reset view**: Not included - users can remove mods if they want to see base stats

### Weapon-Specific
- **Attack modes**: Show all attack modes expanded (primary fire, alt-fire, charged shot, etc.)
- **Damage grouping**: Physical (IPS) first, then elemental types - clear separation
- **Elemental breakdown**: Full hierarchical view (IPS + base elements + combined elements)
- **Multishot display**: Show per-shot damage, multishot as separate stat
- **Crit display**: Raw percentage only (e.g., "187.5%") - users know orange/red crit mechanics
- **Shotgun status**: Show both per-pellet and effective status chance

### Architecture
- **State management**: Ephemeral calculation using `useMemo` - stats are purely derived data
- **Build viewing**: Always calculate client-side (both editing and viewing)
- **Module structure**: Hybrid - pure calculation functions (testable, no React deps) with thin hook wrapper
- **Set bonus logic**: Import from existing `mod-variants.ts` rather than duplicating
- **Shard display**: Inline with mod contributions in the same stat rows
- **Analytics**: Out of scope

### Contribution Tracking
- **Per-mod tracking**: Store which mods contributed how much to each stat
- **Display format**: Show absolute values in main view, percentage breakdown in hover tooltip
- **Umbral set bonuses**: Show final contribution after set bonuses are applied (not separated)
- **Tauforged shards**: No visual distinction - just shows higher values

### Out of Scope for MVP
- Warframe passives (frame-specific stat modifiers)
- Stance combo multipliers / DPS calculations
- Build comparison feature
- Riven mods with random stats
- Exalted weapons / pseudo-exalted inheritance
- Companion Link mods affecting warframe stats
- Analytics/telemetry

## Technical Design

### 1. Stat Parser Module

Create `src/lib/warframe/stat-parser.ts` to parse mod stat data:

```typescript
// Primary source: structured levelStats array from WFCD
// Fallback: regex parsing of description strings

interface ParsedStat {
  type: StatType;
  value: number;
  operation: "flat_add" | "percent_add" | "percent_mult";
  damageType?: DamageType; // For elemental mods
  isConditional?: boolean; // For Galvanized, on-kill mods
  maxStacks?: number; // For stackable effects
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

// Primary function: extract from structured WFCD data
function parseModFromLevelStats(mod: Mod, rank: number): ParsedStat[];

// Fallback function: regex-based string parsing
function parseModStatString(statString: string): ParsedStat | null;

// Combined function with fallback logic
function parseModStats(mod: PlacedMod): ParsedStat[];
```

### 2. Stat Patterns for String Parsing (Fallback)

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
interface StatValue {
  base: number;
  modified: number;
  capped?: number; // If stat has a cap (e.g., efficiency)
  contributions: StatContribution[];
}

interface StatContribution {
  source: "mod" | "shard" | "set_bonus" | "aura";
  name: string; // Mod name or "Archon Shard"
  absoluteValue: number; // Actual contribution amount
  percentOfBonus: number; // Percentage of total bonus (for tooltip)
}

interface CalculatedStats {
  warframe?: {
    health: StatValue;
    shield: StatValue;
    armor: StatValue;
    energy: StatValue;
    sprintSpeed: StatValue;
    abilityStrength: StatValue;
    abilityDuration: StatValue;
    abilityEfficiency: StatValue;
    abilityRange: StatValue;
  };

  weapon?: {
    attackModes: AttackModeStats[]; // All attack modes expanded
    multishot: StatValue;
  };
}

interface AttackModeStats {
  name: string; // "Primary Fire", "Alt Fire", "Charged Shot"
  totalDamage: StatValue;
  criticalChance: StatValue;
  criticalMultiplier: StatValue;
  statusChance: StatValue;
  effectiveStatusChance?: StatValue; // For multi-pellet weapons
  fireRate: StatValue;
  magazineSize?: StatValue;
  reloadTime?: StatValue;
  range?: StatValue;
  damageBreakdown: DamageBreakdown;
}

interface DamageBreakdown {
  // Physical (IPS) - displayed first
  physical: {
    impact?: number;
    puncture?: number;
    slash?: number;
  };
  // Elemental - displayed after physical
  elemental: {
    type: DamageType;
    value: number;
    sources?: string[]; // For tooltip: which mods created this element
  }[];
}

function calculateStats(
  item: BrowseableItem,
  buildState: BuildState,
  showMaxStacks?: boolean // Toggle for conditional mods
): CalculatedStats;
```

### 4. Stat Caps

Warframe has specific stat caps that must be enforced:

```typescript
const STAT_CAPS: Partial<Record<StatType, { min?: number; max?: number }>> = {
  ability_efficiency: { min: 25, max: 175 }, // Can't reduce cost below 25% or above 175%
  ability_duration: { min: 12.5 }, // Minimum duration
  // Add others as discovered
};

function applyStatCap(statType: StatType, value: number): { value: number; capped?: number } {
  const cap = STAT_CAPS[statType];
  if (!cap) return { value };

  let cappedValue = value;
  if (cap.max !== undefined && value > cap.max) cappedValue = cap.max;
  if (cap.min !== undefined && value < cap.min) cappedValue = cap.min;

  return cappedValue !== value
    ? { value: cappedValue, capped: value } // Show waste
    : { value };
}
```

### 5. Calculation Order (Critical)

Warframe's mod system applies bonuses in a specific order:

#### Warframe Stat Order:
1. **Base stat** (from item data)
2. **Flat additions** (rare, e.g., Umbral Vitality has flat bonus)
3. **Percentage additions** (most mods + shards, stack additively)
4. **Set bonuses** (Umbral set multiplier) - import from mod-variants.ts

```
Final Health = (Base + FlatBonus) × (1 + ΣPercentBonuses + ShardBonuses) × SetMultiplier
```

#### Weapon Damage Order:
1. **Base damage** (from attacks array or totalDamage)
2. **Base damage mods** (Serration, Hornet Strike) - additive
3. **Multishot** (Split Chamber) - separate multiplier
4. **Elemental damage** - calculated from modded base, combined in slot order
5. **Critical** - separate calculation

```
Modded Base = Base × (1 + ΣBaseDamageMods)
Final Damage Per Shot = Modded Base + Elemental Damage
```

### 6. Umbral Set Bonus Integration

Import from existing `src/lib/warframe/mod-variants.ts`:

```typescript
import { getUmbralMultiplier } from "@/lib/warframe/mod-variants";

// Usage in calculator
function applyUmbralSetBonus(
  baseValue: number,
  percentBonus: number,
  modName: string,
  equippedUmbralCount: number
): number {
  const setMultiplier = getUmbralMultiplier(modName, equippedUmbralCount);
  return baseValue * (1 + percentBonus * setMultiplier);
}
```

### 7. Archon Shard Integration

Integrate with existing `src/lib/warframe/shards.ts`:

```typescript
import { findStat } from "@/lib/warframe/shards";

// Shard bonuses are additive with mod percentages (inline with mod contributions)
function getShardBonuses(shardSlots: (PlacedShard | null)[]): StatContribution[] {
  const contributions: StatContribution[] = [];

  for (const shard of shardSlots) {
    if (!shard) continue;
    const stat = findStat(shard.color, shard.stat);
    if (!stat) continue;

    const value = shard.tauforged ? stat.tauforgedValue : stat.baseValue;
    contributions.push({
      source: "shard",
      name: `${shard.color} Archon Shard`,
      absoluteValue: value,
      percentOfBonus: 0, // Calculated later
    });
  }

  return contributions;
}
```

### 8. Aura Integration

Include self-affecting auras only:

```typescript
const SELF_AFFECTING_AURAS: Set<string> = new Set([
  "Steel Charge", // +60% melee damage
  "Physique", // +90% health
  "Growing Power", // +25% ability strength (conditional)
  "Energy Siphon", // +0.6 energy/sec
  // ... other self-affecting auras
]);

function isAuraSelfAffecting(auraName: string): boolean {
  return SELF_AFFECTING_AURAS.has(auraName);
}
```

### 9. Conditional Mod Handling

Support toggle between base and max stacks:

```typescript
interface ConditionalModState {
  showMaxStacks: boolean;
}

// In calculation
function getConditionalValue(
  mod: PlacedMod,
  parsedStat: ParsedStat,
  conditionalState: ConditionalModState
): number {
  if (!parsedStat.isConditional) return parsedStat.value;

  if (conditionalState.showMaxStacks && parsedStat.maxStacks) {
    return parsedStat.value * parsedStat.maxStacks;
  }
  return parsedStat.value;
}
```

### 10. React Hook Wrapper

Create `src/hooks/use-calculated-stats.ts`:

```typescript
import { useMemo, useState } from "react";
import { calculateStats } from "@/lib/warframe/stats-calculator";
import type { BrowseableItem, BuildState, CalculatedStats } from "@/lib/warframe/types";

interface UseCalculatedStatsOptions {
  item: BrowseableItem;
  buildState: BuildState;
}

interface UseCalculatedStatsReturn {
  stats: CalculatedStats;
  showMaxStacks: boolean;
  setShowMaxStacks: (value: boolean) => void;
}

export function useCalculatedStats({
  item,
  buildState,
}: UseCalculatedStatsOptions): UseCalculatedStatsReturn {
  const [showMaxStacks, setShowMaxStacks] = useState(false);

  const stats = useMemo(
    () => calculateStats(item, buildState, showMaxStacks),
    [item, buildState, showMaxStacks]
  );

  return { stats, showMaxStacks, setShowMaxStacks };
}
```

### 11. UI Component Design

#### StatRow Component

```tsx
interface StatRowProps {
  label: string;
  stat: StatValue;
  unit?: string;
  format?: "number" | "percent" | "decimal";
}

function StatRow({ label, stat, unit = "", format = "number" }: StatRowProps) {
  const isModified = stat.modified !== stat.base;
  const isIncrease = stat.modified > stat.base;
  const hasCap = stat.capped !== undefined;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-between items-center text-xs cursor-help">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn(
              "font-medium tabular-nums",
              isModified && (isIncrease ? "text-green-500" : "text-red-500")
            )}>
              {formatValue(stat.modified, format)}{unit}
              {hasCap && (
                <span className="text-yellow-500 ml-1">
                  ({formatValue(stat.capped, format)}{unit} uncapped)
                </span>
              )}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <StatBreakdownTooltip stat={stat} format={format} unit={unit} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

#### StatBreakdownTooltip Component

Step-by-step calculation breakdown:

```tsx
interface StatBreakdownTooltipProps {
  stat: StatValue;
  format: "number" | "percent" | "decimal";
  unit: string;
}

function StatBreakdownTooltip({ stat, format, unit }: StatBreakdownTooltipProps) {
  return (
    <div className="space-y-1 text-xs">
      <div className="font-medium border-b pb-1">
        Base: {formatValue(stat.base, format)}{unit}
      </div>

      {stat.contributions.map((contrib, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{contrib.name}</span>
          <span>
            +{formatValue(contrib.absoluteValue, format)}{unit}
            <span className="text-muted-foreground ml-1">
              ({contrib.percentOfBonus.toFixed(1)}%)
            </span>
          </span>
        </div>
      ))}

      <div className="font-medium border-t pt-1">
        Final: {formatValue(stat.modified, format)}{unit}
      </div>

      {stat.capped && (
        <div className="text-yellow-500">
          Capped from {formatValue(stat.capped, format)}{unit}
        </div>
      )}
    </div>
  );
}
```

#### Conditional Toggle Component

```tsx
interface ConditionalToggleProps {
  showMaxStacks: boolean;
  onToggle: (value: boolean) => void;
  hasConditionalMods: boolean;
}

function ConditionalToggle({ showMaxStacks, onToggle, hasConditionalMods }: ConditionalToggleProps) {
  if (!hasConditionalMods) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Switch
        checked={showMaxStacks}
        onCheckedChange={onToggle}
        size="sm"
      />
      <span className="text-muted-foreground">Show at max stacks</span>
    </div>
  );
}
```

### 12. Damage Breakdown Component

For weapons with elemental combinations:

```tsx
interface DamageBreakdownProps {
  breakdown: DamageBreakdown;
}

function DamageBreakdownSection({ breakdown }: DamageBreakdownProps) {
  return (
    <div className="space-y-2">
      {/* Physical damage (IPS) first */}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Physical</span>
        {breakdown.physical.impact && (
          <DamageTypeRow type="impact" value={breakdown.physical.impact} />
        )}
        {breakdown.physical.puncture && (
          <DamageTypeRow type="puncture" value={breakdown.physical.puncture} />
        )}
        {breakdown.physical.slash && (
          <DamageTypeRow type="slash" value={breakdown.physical.slash} />
        )}
      </div>

      {/* Elemental damage after physical */}
      {breakdown.elemental.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Elemental</span>
          {breakdown.elemental.map((elem, i) => (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <DamageTypeRow type={elem.type} value={elem.value} />
                  </div>
                </TooltipTrigger>
                {elem.sources && (
                  <TooltipContent>
                    Combined from: {elem.sources.join(" + ")}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 13. Error Handling

For unparseable stats, log and display raw text:

```typescript
function parseModStats(mod: PlacedMod): ParsedStat[] {
  try {
    // Try structured data first
    const structured = parseModFromLevelStats(mod.mod, mod.rank);
    if (structured.length > 0) return structured;

    // Fall back to string parsing
    return parseModStatStrings(mod);
  } catch (error) {
    console.warn(`Failed to parse mod stats for ${mod.mod.name}:`, error);
    return []; // Return empty, mod won't contribute to calculations
  }
}
```

In UI, show unparseable stats as raw text:

```tsx
function UnparseableStatRow({ rawText }: { rawText: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{rawText}</span>
      <span className="text-muted-foreground italic">Not calculated</span>
    </div>
  );
}
```

## File Structure

```
src/lib/warframe/
├── stat-parser.ts          # Parse mod stat data (structured + string fallback)
├── stats-calculator.ts     # Main calculation engine
├── stat-types.ts           # Type definitions for stats
├── stat-caps.ts            # Stat cap definitions and enforcement
├── aura-effects.ts         # Self-affecting aura definitions
├── mod-variants.ts         # (existing) Umbral set bonus logic
├── shards.ts               # (existing) Archon shard data
└── index.ts                # Updated exports

src/hooks/
└── use-calculated-stats.ts # React hook wrapper

src/components/build-editor/
├── item-sidebar.tsx        # Updated with calculated stats
├── stat-row.tsx            # Stat display with hover tooltip
├── stat-breakdown.tsx      # Step-by-step breakdown tooltip
├── damage-breakdown.tsx    # Weapon damage type breakdown
└── conditional-toggle.tsx  # Max stacks toggle for conditional mods
```

## Implementation Plan

### Phase 1: Core Parser & Calculator
1. Create `stat-types.ts` with all type definitions
2. Create `stat-parser.ts` with WFCD structured data parsing
3. Add string parsing fallback for mods without structured data
4. Create `stats-calculator.ts` with base calculation logic
5. Add stat cap enforcement (`stat-caps.ts`)
6. Handle edge cases (negative values, multiplicative bonuses)

### Phase 2: Warframe Stats
1. Implement health/shield/armor/energy/sprint speed calculations
2. Implement ability stat calculations (strength/duration/efficiency/range)
3. Import and integrate Umbral set bonus from `mod-variants.ts`
4. Integrate Archon Shard bonuses from `shards.ts`
5. Add self-affecting aura support (`aura-effects.ts`)

### Phase 3: Weapon Stats
1. Implement base damage calculations for all attack modes
2. Implement critical chance/multiplier calculations
3. Implement status chance calculations (including effective for multi-pellet)
4. Add elemental damage type combination logic (respecting slot order)
5. Create hierarchical damage breakdown (IPS + elemental)
6. Handle multishot as separate stat

### Phase 4: UI Integration
1. Create `useCalculatedStats` hook
2. Create `StatRow` component with hover tooltip trigger
3. Create `StatBreakdownTooltip` with step-by-step calculation
4. Create `DamageBreakdown` component for weapons
5. Create `ConditionalToggle` for Galvanized/stacking mods
6. Update `ItemSidebar` to use calculated stats
7. Add color coding (green increase, red decrease, yellow capped)

### Phase 5: Polish & Edge Cases
1. Handle Galvanized mod stacking (toggle for max stacks)
2. Handle conditional bonuses display
3. Add arcane stat bonuses integration
4. Performance testing and optimization if needed
5. Comprehensive testing with common and edge case mods

## Testing Strategy

1. **Unit tests** for stat parser with all known patterns (structured + string)
2. **Unit tests** for calculator with known mod combinations
3. **Unit tests** for stat cap enforcement
4. **Snapshot tests** for UI components
5. **Integration tests** comparing output to Warframe wiki values
6. **Test both common mods and edge cases systematically**

### Key Test Cases
- Common mods: Serration, Vitality, Intensify, Split Chamber
- Set mods: Full Umbral set with set bonus application
- Mixed effect mods: Blind Rage (+strength, -efficiency)
- Conditional mods: Galvanized Aptitude at 0 stacks and max stacks
- Elemental combinations: Cold + Toxin = Viral (slot order matters)
- Stat caps: Efficiency at 175% cap with overflow

## Open Questions (Resolved)

1. **Conditional mods**: Toggle to show "at max stacks" values
2. **Rivens**: Deferred to future phase
3. **Companion mods**: Deferred to future phase
4. **Exalted weapons**: Deferred to future work
5. **Compare builds**: Out of scope for MVP

## Success Metrics

- Stats update within 16ms (one frame) of mod drop
- 100% accuracy for common mod combinations
- No visual jank or layout shift during updates
- Hover tooltips provide complete calculation transparency

## References

- [Warframe Wiki: Damage](https://wiki.warframe.com/w/Damage)
- [Warframe Wiki: Armor](https://wiki.warframe.com/w/Armor)
- [WFCD Items Package](https://github.com/WFCD/warframe-items)
- Existing: `src/lib/warframe/capacity.ts` (drain calculations)
- Existing: `src/lib/warframe/shards.ts` (shard data)
- Existing: `src/lib/warframe/mod-variants.ts` (Umbral set bonuses)
