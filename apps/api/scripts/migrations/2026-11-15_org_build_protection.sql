-- Org build protection (PR #483): two nullable columns.
--   builds.organizationSince   when the build joined its current org; its
--                              author may still delete it or move it out for
--                              an hour after (ORG_GRACE_MS, _build-visibility.ts)
--   build_revisions.snapshot   the build before an org build's editing session,
--                              for an org admin's revert (_build-revisions.ts)
-- The API reads and writes both, so this MUST be applied before that API
-- deploys, or every build save and delete fails.
--
-- Additive only. Existing builds get NULL organizationSince, which reads as
-- "joined long ago": no grace period for builds tagged before this.
--
-- Run in the PlanetScale console on `main`, or from apps/api/ with
-- DATABASE_URL pointing at prod:
--   bunx prisma db execute --file scripts/migrations/2026-11-15_org_build_protection.sql

ALTER TABLE "builds" ADD COLUMN IF NOT EXISTS "organizationSince" TIMESTAMP(3);
ALTER TABLE "build_revisions" ADD COLUMN IF NOT EXISTS "snapshot" JSONB;
