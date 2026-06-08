-- Drop the authenticated (key'd) API tables. The /api/v1 surface and all
-- API-key code were removed (see commit "remove the unused authenticated API
-- surface"); these tables are orphaned. No code references them, so this is
-- safe to apply at any time after that change is deployed.
--
-- Apply manually against Neon:
--   bunx prisma db execute --file scripts/migrations/2026-06-08_drop_api_keys.sql
--
-- Drop the child (FK -> api_keys) first.
DROP TABLE IF EXISTS "api_key_rate_limit_windows";
DROP TABLE IF EXISTS "api_keys";
