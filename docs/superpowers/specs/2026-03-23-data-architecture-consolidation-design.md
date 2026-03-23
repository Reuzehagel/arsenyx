# Data Architecture Consolidation — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Goal:** Eliminate the dual JSON/DB architecture for game data. Make the existing JSON-first approach explicit and complete.

## Problem

Arsenyx has three copies of the same Warframe game data (npm package, static JSON files, PostgreSQL tables) with two parallel code paths (in-memory Maps and Prisma queries). The DB path was never fully wired — most of it is dead code. This creates confusion about what's canonical, requires multiple manual sync steps, and adds complexity without benefit.

## Decision

**Option B: Static JSON as the single source of truth for game data.**

- Game data (items, mods, arcanes): static JSON files loaded into in-memory Maps at server start
- User data (builds, guides, votes, favorites): PostgreSQL via Prisma
- No toggle, no dual paths

### Rationale

The game data is static, read-only, small (~28MB), and server-side only (Next.js Server Components never ship it to the client). These properties make in-memory serving the correct architecture — faster than DB round-trips, simpler infrastructure, zero connection pooling concerns. The duality was the source of pain, not the JSON approach itself.

Consensus from three independent reviewers confirmed this recommendation.

## Changes

### 1. Schema Changes

Remove game data tables from `prisma/schema.prisma`:

- **Delete models:** `Item`, `Mod`, `Arcane`, `WfcdSyncLog`
- **Modify `Build` model:**

```diff
model Build {
-  itemId          String
-  item            Item     @relation(fields: [itemId], references: [id])
+  itemUniqueName  String   // WFCD unique name, e.g. "/Lotus/Powersuits/Wraith/Wraith"
+  itemCategory    String   // Browse category, e.g. "warframes"
+  itemName        String   // Denormalized display name, e.g. "Sevagoth"
+  itemImageName   String?  // Denormalized for image rendering without Map lookup
}
```

- `itemUniqueName` is the stable WFCD identifier (already used in build codec and creation input)
- `itemCategory` is needed for URL routing (`/builds/warframes/...`)
- `itemName` is denormalized for search (avoids JOIN to a now-deleted table) and display
- `itemImageName` is denormalized because 15+ components currently access `build.item.imageName` for rendering — avoids secondary Map lookups in every component
- No FK constraint — if WFCD removes an item, handle gracefully in app code
- Update composite indexes:
  - `@@index([itemId])` → `@@index([itemUniqueName])`
  - `@@index([itemId, visibility, voteCount])` → `@@index([itemUniqueName, visibility, voteCount])`

**Breaking change.** Requires `bun run db:push --force-reset` and re-sync of user data. Acceptable in development phase.

### 2. Fix Build Creation

**File:** `src/lib/db/builds.ts` (line ~315)

Current: queries `prisma.item.findUnique()` to convert `uniqueName` → DB `id`, then stores `itemId` FK.

Replace: validate against in-memory data, store string fields directly.

```typescript
import { getItemByUniqueName } from "@/lib/warframe/items";

// In createBuild():
const item = getItemByUniqueName(input.itemUniqueName);
if (!item) throw new Error("Item not found");

// Store directly on build:
await prisma.build.create({
  data: {
    itemUniqueName: input.itemUniqueName,
    itemCategory: item.category,
    itemName: item.name,
    // ... rest of build data
  },
});
```

Same validation, zero DB query for game data.

### 3. Fix All Prisma Queries That Include `item` Relation

The `item` relation is currently included in queries across multiple files. Every `include: { item: { select: ... } }` must be removed since the fields are now directly on `Build`.

**Affected query constants and functions:**

- `src/lib/db/builds.ts`:
  - `buildInclude` (line ~194) — used by `getBuildBySlug`, `getBuildById`, `updateBuild`, `createBuild`
  - `buildListSelect` (line ~245) — used by `getUserBuilds`, `getPublicBuildsForItem`, `getPublicBuilds`
  - `getPublicBuildsForItem` (line ~482) — currently does `prisma.item.findUnique()` to get DB id, then filters by `itemId`. Replace with direct `where: { itemUniqueName }`.
  - `getUserBuildsForPartnerSelector` (line ~696)
- `src/lib/db/favorites.ts` (line ~141) — includes `item` relation when fetching favorite builds

**Type interfaces to update:**
- `BuildWithUser` (line ~46) — currently declares `item: { ... }` nested object
- `BuildListItem` (line ~103) — same

**Strategy:** Construct an `item`-shaped object from the flat fields in a `mapBuildResult` helper to minimize downstream component changes. Components continue to access `build.item.name`, `build.item.imageName`, etc. — the shim is confined to the DB layer.

### 4. Fix Search API

**File:** `src/app/api/search/route.ts`

Two sub-fixes:

**Item search:** Replace `searchItemsFromDb(q)` with in-memory filtering against the items Map. ~400 items — substring match is sub-millisecond.

**Build search:** Keep the `searchVector` tsvector + GIN index (it searches user-generated content — build names, guide text). Remove the `JOIN items i ON i.id = b."itemId"` from the raw SQL query. Use `b."itemName"` directly (now denormalized on the builds table).

**Update `searchVector` trigger:** The existing trigger SELECTs from the `items` table to get the item name:

```sql
-- Current (breaks after items table is dropped):
setweight(to_tsvector('english', coalesce((SELECT name FROM items WHERE id = NEW."itemId"), '')), 'B')

-- Replacement:
setweight(to_tsvector('english', coalesce(NEW."itemName", '')), 'B')
```

The trigger's `UPDATE OF` clause must also change from `name, description, "itemId"` to `name, description, "itemName"`.

**GIN index and trigger setup:** Currently the GIN index and trigger are created by `scripts/sync-wfcd-to-db.ts` (which is being deleted). Move this SQL to a dedicated `scripts/setup-search.sql` that can be run after `db:push --force-reset`. Document in CLAUDE.md as part of the DB reset procedure.

### 6. Dead Code Removal

**Delete files:**
- `src/lib/db/items.ts` — 5 unused DB query functions for game items
- `src/lib/db/mods.ts` — 8 unused DB query functions for mods/arcanes
- `scripts/sync-wfcd-to-db.ts` — 432-line DB sync script

**Update files:**
- `src/lib/db/index.ts` — remove re-exports of deleted items/mods modules
- `package.json` — remove `db:sync` script
- `.env` / `.env.example` — remove `USE_DATABASE` env var
- `CLAUDE.md` — remove references to `USE_DATABASE` toggle, update DB workflow docs

### 7. Automated Data Updates

GitHub Actions workflow running weekly (Sunday night UTC):

```yaml
# .github/workflows/update-warframe-data.yml
on:
  schedule:
    - cron: "0 2 * * 0"  # Sunday 02:00 UTC
  workflow_dispatch: {}    # Manual trigger

jobs:
  update-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun update @wfcd/items
      - run: bun run sync-data
      - name: Check for changes
        id: diff
        run: |
          if git diff --quiet src/data/warframe/; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
          fi
      - name: Create PR
        if: steps.diff.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@v7
        with:
          branch: auto/update-warframe-data
          title: "chore: update @wfcd/items game data"
          body: |
            Automated weekly update of Warframe game data from `@wfcd/items`.
            Review the JSON diffs before merging.
          commit-message: "chore: update @wfcd/items game data"
```

**Frequency:** Weekly. Warframe doesn't patch daily, and WFCD needs time to update after game patches.

**Why PR, not auto-merge:** Bad upstream data can break stat calculations. A quick review of the diff catches obvious problems. Git is the rollback mechanism.

## What Stays the Same

- `@wfcd/items` as the upstream data source
- Static JSON files in `src/data/warframe/`
- In-memory Maps for O(1) lookups (`src/lib/warframe/items.ts`, `mods.ts`)
- PostgreSQL for user content (builds, guides, votes, favorites)
- `cdn.warframestat.us` for images
- Overframe import feature
- `scripts/sync-warframe-data.ts` (copies JSON from node_modules)
- `scripts/convert-overframe-items.ts` (Overframe ID mapping)
- All existing browse/create/build pages (already use in-memory data)

## Future Considerations

- **`warframe-public-export-plus`** could supplement WFCD for recipes, vendors, relics, and localization. Not a replacement (missing mod stats). Add as a secondary source if/when those features are needed.
- **Self-hosted images** would remove the `cdn.warframestat.us` dependency. Not urgent — solve if the CDN becomes unreliable.
- **Fuzzy search** (Fuse.js or similar) could replace substring matching for item search. Easy to add in-memory, no architecture change needed.
- **Pre-computed derived artifacts** during sync (search tokens, compact indices) could reduce cold start parse time. Optimize when measured, not before.
