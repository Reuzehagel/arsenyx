-- Dump the full-text-search schema objects that exist ONLY in the live database.
--
-- Why this file exists: the `searchVector Unsupported("tsvector")` column on
-- `builds`, its GIN index, and the trigger that populates it are not in
-- prisma/schema.prisma and not in any migration. They were applied by hand.
-- That means a routine `prisma db push` silently drops them, search stops
-- matching, and nothing errors -- see apps/api/CLAUDE.md.
--
-- Run this against the live database (PlanetScale dashboard SQL console is the
-- easiest route -- it needs no local psql or DATABASE_URL), then commit the real
-- definitions as a dated migration in apps/api/scripts/migrations/ alongside the
-- existing ones. Everything here is READ-ONLY.
--
-- Once that migration exists, this file's job is done: it becomes the way to
-- verify the checked-in migration still matches production after any schema
-- change.

-- 1. The column itself. Confirms the type is really `tsvector` and whether it
--    is nullable (the app relies on NULL to trigger its ILIKE fallback --
--    see searchBuildIds in apps/api/src/routes/_build-list.ts).
--
--    CRITICAL: is_generated / generation_expression are selected because the
--    column may be `GENERATED ALWAYS AS (...) STORED` rather than populated by a
--    trigger. If it is, queries 3 and 4 below return NOTHING and the entire
--    population logic -- the columns fed in, their setweight() weights, and the
--    text-search configuration -- lives in generation_expression instead. Read
--    this result FIRST and let it decide which of the two mechanisms to look for;
--    concluding "no trigger, nothing to migrate" from an empty query 3 would
--    reproduce exactly the silent-loss failure this file exists to prevent.
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  is_generated,
  generation_expression
FROM information_schema.columns
WHERE table_name = 'builds'
  AND column_name = 'searchVector';

-- 2. Every index on `builds`, with its full definition. We need the GIN index
--    on searchVector verbatim -- including the operator class, which changes
--    query-plan behaviour and is easy to get wrong when reconstructing by hand.
--    Listing all of them also catches any other hand-applied index.
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'builds'
ORDER BY indexname;

-- 3. Triggers on `builds`. pg_get_triggerdef gives the exact CREATE TRIGGER
--    statement: timing (BEFORE/AFTER), events (INSERT/UPDATE), any column list
--    on UPDATE OF, per-row vs per-statement, and the WHEN clause. All of that
--    affects when the vector is refreshed. tgisinternal is excluded so foreign
--    key enforcement triggers do not clutter the output.
SELECT
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'builds'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 4. The trigger function body -- the part that genuinely cannot be inferred
--    from the application code. Specifically it reveals which columns feed the
--    vector, the setweight() weights assigned to each, and the text-search
--    configuration used ('english' vs 'simple' -- this must match the
--    to_tsquery('english', ...) call the app issues, or matching silently
--    degrades). Filtered on tsvector rather than a known name so the function
--    is found regardless of what it is called.
--
--    Two things here are load-bearing, both learned the hard way:
--
--    `p.prokind = 'f'` restricts this to plain functions. pg_get_functiondef()
--    RAISES on an aggregate ("array_agg" is an aggregate function) rather than
--    returning NULL, so without this the query aborts instead of returning rows.
--
--    The tsvector filter uses `p.prosrc` -- a plain catalog column -- and NOT
--    pg_get_functiondef(). Postgres does not evaluate WHERE conditions in
--    written order, so calling pg_get_functiondef() in the WHERE clause lets it
--    reach pg_catalog rows before the nspname filter excludes them, and it dies
--    on the first aggregate it touches. Keeping the throwing function out of the
--    WHERE clause entirely -- it stays in the SELECT list, which is evaluated
--    only for rows that already survived -- is what makes this safe.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS source
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind = 'f'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prosrc ILIKE '%tsvector%'
ORDER BY p.proname;

-- 5. Sanity check: how many rows actually have a populated vector. A non-zero
--    NULL count in production means some rows are silently falling back to
--    ILIKE (unindexed, and ranked by an empty tsvector) rather than matching
--    through the GIN index.
SELECT
  COUNT(*) AS total_builds,
  COUNT("searchVector") AS with_vector,
  COUNT(*) - COUNT("searchVector") AS missing_vector
FROM builds;
