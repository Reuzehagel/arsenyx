-- Rename votes → likes, favorites → bookmarks.
-- Apply BEFORE `prisma db push` against a DB that already has the old names,
-- otherwise db push will drop+recreate the columns/tables and lose data.
--
-- Run:
--   psql "$DATABASE_URL" -f apps/api/scripts/migrations/2026-04-20_rename_votes_to_likes.sql

BEGIN;

ALTER TABLE builds RENAME COLUMN "voteCount" TO "likeCount";
ALTER TABLE builds RENAME COLUMN "favoriteCount" TO "bookmarkCount";

ALTER TABLE build_votes RENAME TO build_likes;
ALTER TABLE build_favorites RENAME TO build_bookmarks;

ALTER TABLE users
  ADD COLUMN "defaultBuildVisibility" "BuildVisibility" NOT NULL DEFAULT 'PUBLIC';

COMMIT;
