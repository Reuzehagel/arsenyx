-- Adds the admin-granted verified flag for organizations. Verified orgs
-- render purple (--color-wf-org) across the site; unverified render muted.
--
-- Apply to prod (PlanetScale) BEFORE merging the API change (from apps/api/,
-- with DATABASE_URL pointed at the prod direct string):
--   bunx prisma db execute --file scripts/migrations/2026-07-03_org_verified.sql

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS "verified" boolean NOT NULL DEFAULT false;
