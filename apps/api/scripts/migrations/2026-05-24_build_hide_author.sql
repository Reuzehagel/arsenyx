-- Adds an opt-in flag for org builds: when true, the author's handle is
-- hidden from card / detail UI. No effect on solo builds.
--
-- Run against Neon (from apps/api/):
--   bunx prisma db execute --file scripts/migrations/2026-05-24_build_hide_author.sql

ALTER TABLE builds
  ADD COLUMN IF NOT EXISTS "hideAuthor" boolean NOT NULL DEFAULT false;
