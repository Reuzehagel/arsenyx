-- Codify the full-text search apparatus on `builds`. Every object below existed
-- ONLY in the live database — applied by hand, absent from prisma/schema.prisma
-- and from every migration — so a routine `prisma db push` would have dropped it
-- and search would have silently stopped matching with no error and no diff.
-- Definitions in sections 1-3 are verbatim from production (captured 2026-08-04
-- via scripts/dump-search-schema.sql); section 5 is NEW — see its note.
--
-- The `searchVector` column stays `Unsupported("tsvector")` in the Prisma schema:
-- Prisma can neither generate the trigger nor index the type, so this file is the
-- source of truth for the whole apparatus. Any rebuild must apply it.
--
-- Idempotent — safe to re-run.
--
-- Run against PlanetScale (from apps/api/):
--   bunx prisma db execute --file scripts/migrations/2026-08-04_build_search_vector.sql

BEGIN;

-- 1. The tsvector column. Deliberately NULLABLE: searchBuildIds
--    (src/routes/_build-list.ts) treats a NULL vector as the signal to fall back
--    to ILIKE matching, which is what makes a freshly-pushed dev DB searchable
--    before the trigger has ever fired.
ALTER TABLE "builds" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 2. The trigger function. Weights are load-bearing for ts_rank ordering:
--    name = A (highest), itemName = B, description = C. The 'english'
--    configuration MUST match the to_tsquery('english', ...) the application
--    issues in searchBuildIds — a mismatch here does not error, it just makes
--    stemming disagree so queries quietly stop matching documents they should.
CREATE OR REPLACE FUNCTION public.builds_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW."searchVector" := (
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."itemName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C')
  );
  RETURN NEW;
END;
$function$;

-- 3. The trigger. `UPDATE OF` lists exactly the three columns the function reads,
--    so an unrelated column write (likeCount, viewCount, buildData — the hot
--    ones) does not pay to recompute the vector. Keep this list in sync with the
--    coalesce() calls above: a column added to the function but not to this list
--    would go stale on update while looking correct on insert.
--
--    DROP + CREATE rather than CREATE OR REPLACE TRIGGER, which needs PG 14+.
DROP TRIGGER IF EXISTS builds_search_vector_trigger ON public."builds";
CREATE TRIGGER builds_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "name", "description", "itemName"
  ON public."builds"
  FOR EACH ROW
  EXECUTE FUNCTION builds_search_vector_update();

-- 4. Backfill rows the trigger never saw — the case where this file is applied to
--    a table that already has data (a rebuild, or a dev DB pushed before the
--    trigger existed). A no-op in production as of 2026-08-04: all 1078 rows
--    already have a vector.
--
--    `SET "name" = "name"` deliberately writes a column in the trigger's UPDATE OF
--    list rather than recomputing the tsvector expression here. Postgres fires
--    UPDATE OF on column *assignment*, not on value change, so this runs the real
--    trigger — which means the backfill cannot drift from the function above the
--    way a duplicated setweight() expression would.
UPDATE "builds" SET "name" = "name" WHERE "searchVector" IS NULL;

-- 5. The GIN index. THIS IS NEW — it did NOT exist in production on 2026-08-04,
--    despite both apps/api/CLAUDE.md and the comment in searchBuildIds asserting
--    it did. Every full-text search was therefore a sequential scan evaluating
--    `@@` per row. Harmless at 1078 rows (the planner would likely choose a seq
--    scan at this size regardless) but it degrades linearly, and the surrounding
--    code was written believing the index was there.
--
--    Named in snake_case to match the hand-applied trigger/function rather than
--    Prisma's quoted-camelCase index convention, so it reads as owned by this
--    file and not by the schema.
--
--    Not CONCURRENTLY: that cannot run inside a transaction block, and at this
--    table size a plain build takes milliseconds. If `builds` has grown large
--    before this is applied, pull this statement out of the transaction and run
--    it CONCURRENTLY instead.
CREATE INDEX IF NOT EXISTS builds_search_vector_gin_idx
  ON public."builds" USING gin ("searchVector");

COMMIT;
