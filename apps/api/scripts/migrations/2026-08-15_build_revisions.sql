-- Append-only edit log for builds (issue #331). One row per accepted PATCH,
-- carrying the editor, the time, and a small server-computed change list —
-- never a snapshot of buildData. Written inside the same statement as the
-- build update (routes/builds.ts), so this table MUST exist before the API
-- that writes to it deploys, or every save fails.
--
-- `editorId` is nullable with ON DELETE SET NULL on purpose: deleting an
-- account must not delete the history of builds that account edited. The
-- entry survives, un-attributed.
--
-- Additive only — no existing table is touched.
--
-- Run against PlanetScale (from apps/api/, with DATABASE_URL pointing at prod):
--   bunx prisma db execute --file scripts/migrations/2026-08-15_build_revisions.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BuildRevisionKind') THEN
    CREATE TYPE "BuildRevisionKind" AS ENUM ('CREATED', 'EDITED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "build_revisions" (
  "id" TEXT NOT NULL,
  "buildId" TEXT NOT NULL,
  "editorId" TEXT,
  "kind" "BuildRevisionKind" NOT NULL DEFAULT 'EDITED',
  "note" VARCHAR(300),
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "build_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "build_revisions_buildId_createdAt_idx"
  ON "build_revisions" ("buildId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'build_revisions_buildId_fkey'
  ) THEN
    ALTER TABLE "build_revisions"
      ADD CONSTRAINT "build_revisions_buildId_fkey"
      FOREIGN KEY ("buildId") REFERENCES "builds"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'build_revisions_editorId_fkey'
  ) THEN
    ALTER TABLE "build_revisions"
      ADD CONSTRAINT "build_revisions_editorId_fkey"
      FOREIGN KEY ("editorId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
