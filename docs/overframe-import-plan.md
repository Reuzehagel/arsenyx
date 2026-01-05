# Plan: Overframe Build Import Feature

## Overview

Add the ability to import builds from Overframe.gg URLs into Arsenix. Given a URL like:
```
https://overframe.gg/build/935570/uriel/fire-and-brimstone-uriel-hybrid-nuke-and-weapon-platform/
```

The system should:
1. Fetch the build data from Overframe
2. Match the warframe/weapon and mods to Arsenix's WFCD data
3. Create a new build with the correct mods, forma, arcanes, and shards in place

---

## Technical Analysis

### Overframe Data Structure

Overframe.gg is a Next.js application that embeds build data in `<script id="__NEXT_DATA__">` tags. The build data structure (based on web research) contains:

- **Item identification**: Warframe/weapon name and slug
- **Mod slots**: Array of 8 normal mods + aura + exilus
- **Mod details**: Name, rank, and position
- **Polarities**: Per-slot polarity changes (forma)
- **Arcanes**: 1-2 equipped arcanes with ranks
- **Shards**: (Warframes) 5 archon shard slots with color/stat/tauforged

### Arsenix Build Structure

From `src/lib/warframe/types.ts`, the `BuildState` interface requires:

```typescript
interface BuildState {
  itemUniqueName: string;      // WFCD unique name
  itemName: string;
  itemCategory: BrowseCategory;
  hasReactor: boolean;
  auraSlot?: ModSlot;          // Warframes only
  exilusSlot: ModSlot;
  normalSlots: ModSlot[];      // 8 slots
  arcaneSlots: PlacedArcane[]; // 2 for warframes
  shardSlots: (PlacedShard | null)[];
  formaCount: number;
  // ...
}
```

### Matching Challenge

The main challenge is **name matching**:
- Overframe uses display names (e.g., "Primed Continuity")
- Arsenix uses WFCD's `uniqueName` as the primary identifier
- Names must be fuzzy-matched to handle slight differences

---

## Implementation Plan

### Phase 1: Overframe Data Fetching

#### 1.1 Create API Route for Fetching Overframe Builds

**File**: `src/app/api/import/overframe/route.ts`

```typescript
// Server-side API route to fetch and parse Overframe build data
// Avoids CORS issues by fetching from server
export async function POST(request: Request) {
  const { url } = await request.json();

  // Validate Overframe URL format
  // Fetch the page HTML
  // Parse __NEXT_DATA__ script tag
  // Extract and return build data
}
```

**Key tasks**:
- Validate URL matches pattern: `https://overframe.gg/build/\d+/[^/]+/[^/]+/?`
- Fetch page HTML with appropriate User-Agent
- Extract JSON from `<script id="__NEXT_DATA__">` tag
- Navigate to the build data in the JSON structure (likely `props.pageProps.build` or similar)
- Return normalized build data

#### 1.2 Define Overframe Build Types

**File**: `src/lib/overframe/types.ts`

Define TypeScript interfaces for Overframe's build data structure:

```typescript
interface OverframeBuild {
  item: {
    name: string;
    slug: string;
    category: string;
  };
  mods: OverframeMod[];
  aura?: OverframeMod;
  exilus?: OverframeMod;
  arcanes?: OverframeArcane[];
  polarities?: OverframePolarity[];
  shards?: OverframeShard[];
}

interface OverframeMod {
  name: string;
  rank: number;
  slotIndex: number;
}
// ... etc
```

---

### Phase 2: Name Matching System

#### 2.1 Create Name Matching Utilities

**File**: `src/lib/overframe/name-matcher.ts`

Build a robust name matching system to handle:
- Exact matches
- Case-insensitive matches
- Fuzzy matches (Levenshtein distance)
- Special cases (Primed, Umbral, Galvanized variants)

```typescript
export function findMatchingItem(
  overframeName: string,
  category: BrowseCategory
): BrowseableItem | null;

export function findMatchingMod(
  overframeName: string,
  compatibleMods: Mod[]
): Mod | null;

export function findMatchingArcane(
  overframeName: string
): Arcane | null;
```

**Matching strategy**:
1. Try exact match (case-insensitive)
2. Try normalized match (remove special characters, spaces)
3. Try fuzzy match with similarity threshold (>0.85)
4. Return null if no match found (caller handles gracefully)

#### 2.2 Build Name Index

**File**: `src/lib/overframe/name-index.ts`

Pre-build lookup tables for faster matching:

```typescript
// Build once on module load
const modsByNormalizedName = new Map<string, Mod>();
const itemsByNormalizedName = new Map<string, BrowseableItem>();
const arcanesByNormalizedName = new Map<string, Arcane>();

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
```

---

### Phase 3: Build Conversion

#### 3.1 Create Build Converter

**File**: `src/lib/overframe/convert-build.ts`

Convert Overframe build data to Arsenix `BuildState`:

```typescript
export interface ConversionResult {
  buildState: Partial<BuildState>;
  warnings: ConversionWarning[];
  errors: ConversionError[];
}

export interface ConversionWarning {
  type: 'mod_not_found' | 'arcane_not_found' | 'shard_not_found';
  slotIndex?: number;
  originalName: string;
  suggestion?: string;
}

export function convertOverframeBuild(
  overframeBuild: OverframeBuild,
  arsenixItem: BrowseableItem,
  compatibleMods: Mod[]
): ConversionResult;
```

**Conversion steps**:
1. Map item to Arsenix item (validate category matches)
2. Create base `BuildState` with item info and innate polarities
3. For each Overframe mod:
   - Find matching Arsenix mod
   - Create `PlacedMod` with rank
   - Place in correct slot (respecting slotIndex)
4. Apply forma polarities to slots
5. Convert arcanes (match by name, set rank)
6. Convert shards (match color and stat name)
7. Calculate formaCount based on polarity changes
8. Return result with any warnings for unmatched mods

#### 3.2 Handle Polarity Mapping

**File**: `src/lib/overframe/polarity-mapper.ts`

Map Overframe polarity names to Arsenix `Polarity` type:

```typescript
const OVERFRAME_POLARITY_MAP: Record<string, Polarity> = {
  'madurai': 'madurai',
  'vazarin': 'vazarin',
  'naramon': 'naramon',
  'zenurik': 'zenurik',
  'unairu': 'unairu',
  'penjaga': 'penjaga',
  'umbra': 'umbra',
  // Overframe may use different names
  'v': 'madurai',
  'd': 'vazarin',
  'dash': 'naramon',
  // etc
};

export function mapPolarity(overframePolarity: string): Polarity;
```

---

### Phase 4: User Interface

#### 4.1 Import Dialog Component

**File**: `src/components/build-editor/import-build-dialog.tsx`

Create a dialog for importing builds:

```tsx
export function ImportBuildDialog({
  open,
  onOpenChange,
  onImport,
}: ImportBuildDialogProps) {
  // URL input field
  // "Import" button
  // Loading state
  // Error display
  // Warnings display (missing mods, etc.)
  // Confirmation with preview
}
```

**UI flow**:
1. User clicks "Import Build" button
2. Dialog opens with URL input
3. User pastes Overframe URL
4. System fetches and parses build
5. Shows preview with any warnings (e.g., "Mod X not found")
6. User confirms import
7. Build state is populated, dialog closes

#### 4.2 Add Import Button to Build Editor

**File**: `src/components/build-editor/build-container.tsx`

Add import functionality to the build editor header:

```tsx
// Add to toolbar/header area
<Button variant="outline" onClick={() => setImportDialogOpen(true)}>
  <Import className="w-4 h-4 mr-2" />
  Import from Overframe
</Button>

<ImportBuildDialog
  open={importDialogOpen}
  onOpenChange={setImportDialogOpen}
  onImport={handleImportBuild}
/>
```

#### 4.3 Import Handler

Add handler function to apply imported build:

```typescript
const handleImportBuild = async (overframeBuild: ConversionResult) => {
  // Apply the converted build state
  // Show toast for any warnings
  // Focus on first empty/warning slot
};
```

---

### Phase 5: Error Handling & Edge Cases

#### 5.1 Handle Missing Mods

When a mod can't be matched:
- Log warning to conversion result
- Leave slot empty
- Show user which mods couldn't be imported
- Suggest similar mod names if fuzzy match found

#### 5.2 Handle Category Mismatches

- If Overframe says "Rifle" but mod is "Shotgun" compatible, still try to place
- Arsenix's existing slot validation will reject invalid placements
- Show warning to user about incompatible mods

#### 5.3 Handle New/Unknown Items

- If warframe/weapon doesn't exist in WFCD data (new release)
- Show clear error message
- Suggest updating WFCD data (`bun run update-data`)

#### 5.4 Rate Limiting

- Cache Overframe responses (5-minute TTL)
- Limit import requests per user/IP
- Graceful failure if Overframe is unavailable

---

## File Structure

```
src/
├── app/
│   └── api/
│       └── import/
│           └── overframe/
│               └── route.ts          # API endpoint for fetching
├── lib/
│   └── overframe/
│       ├── index.ts                  # Public exports
│       ├── types.ts                  # Overframe data types
│       ├── fetch.ts                  # Fetch and parse logic
│       ├── name-matcher.ts           # Name matching utilities
│       ├── name-index.ts             # Pre-built lookup tables
│       ├── polarity-mapper.ts        # Polarity conversion
│       └── convert-build.ts          # Main conversion logic
└── components/
    └── build-editor/
        └── import-build-dialog.tsx   # Import UI
```

---

## Implementation Order

1. **Phase 1.2**: Define Overframe types (understand the data structure first)
2. **Phase 1.1**: Create API route for fetching (need real data to test)
3. **Phase 2**: Name matching system (critical for accurate imports)
4. **Phase 3**: Build conversion (the core logic)
5. **Phase 4**: User interface (final user-facing piece)
6. **Phase 5**: Error handling refinements (polish)

---

## Testing Strategy

### Manual Testing
1. Test with various Overframe build URLs:
   - Warframe builds (with shards, arcanes, helminth)
   - Primary/Secondary/Melee weapon builds
   - Builds with all forma'd slots
   - Builds with missing/corrupted data

### Edge Cases to Test
- Primed vs regular mod matching
- Galvanized mod matching
- Arcane rank handling
- Shard tauforged status
- Empty slots in source build
- Partial/incomplete Overframe builds

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Overframe blocks scraping | Add appropriate User-Agent, rate limit, consider reaching out to Overframe devs |
| __NEXT_DATA__ structure changes | Version the parser, graceful degradation |
| Name matching inaccuracies | Fuzzy matching with user confirmation, manual override option |
| WFCD data out of sync | Clear error messages, suggest data update |
| Performance with large mod lists | Pre-build indexes, cache matching results |

---

## Future Enhancements

1. **Warframe-Builder.com import**: Similar approach for other build sites
2. **Export to Overframe**: Generate Overframe-compatible build URLs
3. **Batch import**: Import multiple builds from a user's Overframe profile
4. **Build comparison**: Side-by-side compare imported vs existing build

---

## Open Questions

1. **Overframe API**: Does Overframe have an official API we could use instead of scraping?
2. **Authentication**: Should import require user login (for rate limiting)?
3. **Build attribution**: Should we link back to original Overframe build?
