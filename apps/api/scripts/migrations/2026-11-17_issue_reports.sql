-- Issues users file from the site (POST /reports, routes/reports.ts). The
-- route writes here after creating the GitHub issue, so this table MUST exist
-- before the API that writes to it deploys, or every report 500s after its
-- issue was already filed.
--
-- Additive only — no existing table is touched.
--
-- Run in the PlanetScale console on `main`, or from apps/api/ with
-- DATABASE_URL pointing at prod:
--   bunx prisma db execute --file scripts/migrations/2026-11-17_issue_reports.sql

CREATE TABLE IF NOT EXISTS "issue_reports" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "issueNumber" INTEGER NOT NULL,
  "issueUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "issue_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "issue_reports_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "issue_reports_userId_createdAt_idx"
  ON "issue_reports"("userId", "createdAt");
