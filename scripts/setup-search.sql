-- Setup full-text search for builds
-- Run after: bun run db:push --force-reset
-- Usage: psql $DATABASE_URL -f scripts/setup-search.sql

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_builds_search_vector
  ON builds USING GIN("searchVector");

-- Trigger function to auto-update searchVector on insert/update
CREATE OR REPLACE FUNCTION builds_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := (
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."itemName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if it exists (may reference old columns)
DROP TRIGGER IF EXISTS builds_search_vector_trigger ON builds;

-- Create trigger
CREATE TRIGGER builds_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, "itemName"
  ON builds
  FOR EACH ROW
  EXECUTE FUNCTION builds_search_vector_update();

-- Backfill searchVector for any existing builds
UPDATE builds SET name = name WHERE true;
