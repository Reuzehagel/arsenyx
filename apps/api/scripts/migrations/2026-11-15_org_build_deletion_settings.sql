-- Org build deletion settings: two columns on organizations.
--   membersDeleteOwnBuilds  lets a current member delete (or move out) the
--                           org builds they authored; false keeps deletion
--                           admin-only, as before
--   authorGraceMinutes      the author's take-back window after a build joins
--                           the org; NULL is the default hour, 0 turns it off
-- The API selects both on org reads and deletion checks, so this MUST be
-- applied before that API deploys.
--
-- Additive only: existing orgs keep today's behaviour (false / NULL).
--
-- Run from apps/api/ with DATABASE_URL pointing at prod:
--   bunx prisma db execute --file scripts/migrations/2026-11-15_org_build_deletion_settings.sql
-- Safe to re-run.

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "membersDeleteOwnBuilds" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "authorGraceMinutes" INTEGER;
