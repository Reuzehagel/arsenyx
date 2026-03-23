# Arsenyx — Data Architecture Problem Case

## Context

Arsenyx is a Warframe build planner (Next.js 16, React 19, TypeScript, Postgres, Prisma). Users can create, share, and discover equipment builds with mod/arcane configurations, stat calculations, and rich text guides.

The app needs comprehensive Warframe game data: ~400 items (warframes, weapons, companions), ~1500 mods with per-rank stat values, ~200 arcanes, plus images for all of them.

## Current State

The data architecture has grown organically and now pulls from multiple sources with overlapping responsibilities:

### Data Sources

| Source | What it provides | Format | How it's used |
|--------|-----------------|--------|---------------|
| `@wfcd/items` (npm) | Items, mods, arcanes with full stats | JSON (~28MB) | Copied to local files via sync script |
| `src/data/warframe/` | Same WFCD data, checked into repo | 13 JSON files | Imported at server start, cached in Maps |
| PostgreSQL | WFCD data duplicated into tables + all user content | Relational + JSON columns | Optional (toggle exists but isn't fully wired) |
| Overframe | Build imports from overframe.gg | HTML scraping + CSV ID mapping | User-facing import feature |
| `cdn.warframestat.us` | Item images | HTTPS | Next.js Image remote pattern |
| `wiki.warframe.com` | Backup images | HTTPS | Fallback |

### Data Flow

```
@wfcd/items (npm package)
    │
    ├── bun run sync-data ──→ src/data/warframe/*.json (static files)
    │                              │
    │                              ├── ES6 import at server start
    │                              └── Precomputed Maps (O(1) lookups)
    │
    └── bun run db:sync ───→ PostgreSQL (Item, Mod, Arcane tables)
                                   │
                                   └── Prisma queries (optional, not fully wired)

User data (builds, guides, votes) ──→ PostgreSQL (always)
```

### Pain Points

1. **Data freshness**: When Warframe updates, someone has to manually run `bun run update-data` (bumps npm package) + `bun run db:sync`. WFCD also has its own lag before they update their package.

2. **Architectural confusion**: The same game data exists in three places (npm package, JSON files, database). There's a `USE_DATABASE` env toggle that was never fully implemented. It's unclear what's canonical. Adding a feature means asking "do I query the DB or use the in-memory Map?"

3. **Multiple sync steps**: Updating data requires: bump npm package → run sync-data → run db:sync → verify. Each step can fail independently.

## Key Constraint

The app uses Next.js Server Components. All game data is loaded and queried **server-side** — users never download the raw JSON files. A browse page sends maybe 5-10KB of rendered data to the client regardless of how the server sourced it.

User-generated content (builds, guides, votes, favorites) must live in PostgreSQL — that's not up for debate.

## Options Under Consideration

### Option A: Database as the single source for game data

- PostgreSQL is THE source for all game data. Delete static JSON files from the repo.
- Single sync pipeline: `@wfcd/items` → `db:sync` → Postgres.
- All app code queries via Prisma. Kill the `USE_DATABASE` toggle (always DB).
- Automate via GitHub Actions cron (daily bump + sync).

**Advantages:**
- One source, one pipeline, one access pattern
- Removes ~28MB of JSON from the repo
- Full-text search via GIN indexes
- "Standard" architecture — everything in the DB

**Disadvantages:**
- Every page load = network round-trip to DB for reference data
- Serverless connection pooling complexity (PgBouncer, Prisma Accelerate, etc.)
- Adds query overhead for data that is fundamentally static and read-only
- Dev setup always requires Docker + running DB
- Game data doesn't benefit from ACID/transactions — it's never written at runtime

### Option B: Static JSON as the single source for game data

- Keep JSON files as the canonical game data source. Delete game data tables (Item, Mod, Arcane) from Postgres.
- Postgres stores only user content + a `uniqueName` foreign key to reference game items.
- In-memory Maps for O(1) lookups (current approach, already works well).
- Automate via GitHub Actions cron: bump `@wfcd/items`, run `sync-data`, open PR if data changed.

**Advantages:**
- Zero-latency queries (in-memory, nanoseconds vs DB round-trips)
- No connection pooling headaches for game data
- Simpler infrastructure — DB only does what DBs are good at (user content with writes)
- Already working and battle-tested in the current codebase
- Eliminates the JSON-vs-DB duality (which is the core complexity pain)

**Disadvantages:**
- ~28MB of JSON stays in the repo (or downloaded at build time)
- ~50MB server memory per instance for cached Maps
- Serverless cold start: ~200-500ms to parse JSON on first request
- Full-text search is less powerful than Postgres GIN indexes (in-memory filtering only)
- "Unusual" architecture — might raise eyebrows

### Option C: Hybrid with clear separation

- JSON files for game data in dev (fast, no Docker needed)
- DB for game data in production (proper queries, lower memory)
- `NODE_ENV` determines which code path

**Advantages:**
- Best local dev experience
- Production gets proper DB queries

**Disadvantages:**
- Two code paths to maintain (this is essentially the current problem)
- Risk of behavior divergence between dev and prod
- Doesn't simplify the mental model

## Additional Considerations

### Data source alternatives

[`warframe-public-export-plus`](https://github.com/calamity-inc/warframe-public-export-plus) is an alternative to `@wfcd/items` — it's derived from the actual game client public export, available on npm, has clean localization separation, and includes data WFCD doesn't (recipes, vendors, relics). However, it lacks mod stat values per rank (only 1 of ~1570 mods has `levelStats`), which are critical for a build planner's stat calculator. WFCD has these because they're manually curated.

Could potentially be used as a supplementary source for data WFCD doesn't cover.

### Image hosting

Currently dependent on `cdn.warframestat.us` (WFCD community CDN). Self-hosting images would add control but also ~2-3GB of storage + serving complexity. Not an immediate problem but worth noting as a dependency.

### Automation

Regardless of which option is chosen, the manual update process should be automated. Options:
- GitHub Actions cron (daily/weekly) that bumps `@wfcd/items` and opens a PR
- Webhook triggered on `@wfcd/items` npm publish
- For DB sync: run as part of deployment pipeline

## Questions

1. Is putting static reference data in a database over-engineering, or is it the "right" long-term choice?
2. How much should serverless cold start / memory matter at this stage?
3. Is the in-memory JSON approach a scaling concern, or is ~50MB per instance totally fine for the foreseeable future?
4. Any experience with automating npm package bumps for data dependencies?
