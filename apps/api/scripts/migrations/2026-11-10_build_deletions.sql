-- Tombstone per deleted build: who deleted it, when, and a full copy of the
-- row plus its guide (deleteBuild in routes/_build-snapshot.ts). Written in the
-- same transaction as the delete, so this table MUST exist before the API that
-- writes to it deploys, or every build delete fails.
--
-- Additive only — no existing table is touched.
--
-- Run in the PlanetScale console on `main`, or from apps/api/ with
-- DATABASE_URL pointing at prod:
--   bunx prisma db execute --file scripts/migrations/2026-11-10_build_deletions.sql

CREATE TABLE IF NOT EXISTS "build_deletions" (
  "id" TEXT NOT NULL,
  "buildId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "deletedById" TEXT NOT NULL,
  "build" JSONB NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "build_deletions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "build_deletions_deletedAt_idx" ON "build_deletions"("deletedAt");
CREATE INDEX IF NOT EXISTS "build_deletions_slug_idx" ON "build_deletions"("slug");
