-- Per-owner variant targets for the partner-builds strip (issue #302):
-- map of partner Build id -> variant index the related-builds chip should
-- open (`?v=` on the viewer). One-sided companion to "partnerOrder".
--
-- Additive + idempotent. MUST be applied to prod (PlanetScale) BEFORE the
-- API deploy that references it, or the partner routes start erroring.
-- Run (from apps/api/, with DATABASE_URL pointing at the target DB):
--   bunx prisma db execute --file scripts/migrations/2026-07-16_build_partner_variants.sql

ALTER TABLE builds
  ADD COLUMN IF NOT EXISTS "partnerVariants" jsonb NOT NULL DEFAULT '{}';
