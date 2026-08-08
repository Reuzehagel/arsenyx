# Full-text build search

**Source of truth: [apps/api/scripts/migrations/2026-08-04_build_search_vector.sql](../apps/api/scripts/migrations/2026-08-04_build_search_vector.sql). Any rebuild must apply it.**

Prisma can neither generate a trigger nor index a `tsvector`, so the whole search apparatus lives outside the schema:

- the `searchVector Unsupported("tsvector")` column
- the `builds_search_vector_update()` trigger function — weights `name`=A, `itemName`=B, `description`=C, config `'english'`
- its trigger
- the GIN index

`prisma db push` alone drops the trigger, and search then silently stops matching with no error.

## After any schema change

Re-verify the live DB still matches the migration with [apps/api/scripts/dump-search-schema.sql](../apps/api/scripts/dump-search-schema.sql) — read-only, runs in PlanetScale's SQL console, needs no local `psql` or `DATABASE_URL`.

## Two findings from the 2026-08-04 dump, worth not re-learning

- The trigger's `'english'` config must match the `to_tsquery('english', …)` in `searchBuildIds`, or stemming disagrees silently.
- **The GIN index never actually existed in production** — despite both the migration file and the trigger function's own comment claiming it did. Every search was a sequential scan until that migration landed.
