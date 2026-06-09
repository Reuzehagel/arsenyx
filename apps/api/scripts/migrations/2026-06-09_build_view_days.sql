-- Per-day view buckets feeding the "trending" build-list sort. `viewCount` on
-- builds stays the all-time counter; this table records views per calendar day
-- (UTC) so the list endpoint can sum the trailing 30-day window. Written next to
-- the viewCount bump in maybeIncrementView (builds.ts) under the same guards;
-- rows past the window are pruned opportunistically.
--
-- Run against Neon (from apps/api/):
--   bunx prisma db execute --file scripts/migrations/2026-06-09_build_view_days.sql

CREATE TABLE IF NOT EXISTS "build_view_days" (
  "buildId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "build_view_days_pkey" PRIMARY KEY ("buildId", "day")
);

CREATE INDEX IF NOT EXISTS "build_view_days_day_idx" ON "build_view_days" ("day");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'build_view_days_buildId_fkey'
  ) THEN
    ALTER TABLE "build_view_days"
      ADD CONSTRAINT "build_view_days_buildId_fkey"
      FOREIGN KEY ("buildId") REFERENCES "builds"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
