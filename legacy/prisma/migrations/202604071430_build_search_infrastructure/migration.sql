-- Ensure fresh migration-managed databases include the build search objects
-- that previously lived only in scripts/setup-search.sql.

CREATE INDEX IF NOT EXISTS "idx_builds_search_vector"
  ON "builds" USING GIN("searchVector");

CREATE OR REPLACE FUNCTION "builds_search_vector_update"() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := (
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."itemName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "builds_search_vector_trigger" ON "builds";

CREATE TRIGGER "builds_search_vector_trigger"
  BEFORE INSERT OR UPDATE OF "name", "description", "itemName"
  ON "builds"
  FOR EACH ROW
  EXECUTE FUNCTION "builds_search_vector_update"();

UPDATE "builds" SET "name" = "name" WHERE true;
