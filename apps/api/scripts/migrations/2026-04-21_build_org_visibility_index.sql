-- Composite index for the `_count.builds where visibility=PUBLIC` correlated
-- subquery used by /orgs/public (directory) and /orgs/:slug (profile page).
-- Without this, Postgres uses the organizationId index and filters visibility
-- in-heap per row — fine at small scale, degrades linearly as any org
-- accumulates builds.
--
-- CONCURRENTLY cannot run inside a transaction block, so no BEGIN/COMMIT.
-- IF NOT EXISTS makes re-runs safe.
--
-- Run against Neon (from apps/api/):
--   bunx prisma db execute --file scripts/migrations/2026-04-21_build_org_visibility_index.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS "builds_organizationId_visibility_idx"
  ON builds ("organizationId", "visibility");
