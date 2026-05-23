-- Null out user image URLs that don't pass validateExternalUrl (mirrors the
-- organizations.image backfill). user.image is populated by Better Auth from
-- OAuth providers and, going forward, validated on create/update via a
-- databaseHooks hook. This catches pre-validation rows.
--
-- Web rendering already routes user.image through Cloudflare Image Resizing
-- (proxyImage), so visitor IPs are protected regardless. This migration is
-- defence-in-depth — any downstream code path that trusts the stored value
-- as "already validated" gets the right answer.
--
-- Run in Neon SQL editor or via:
--   bunx prisma db execute --file scripts/migrations/2026-05-23_null_invalid_user_images.sql

UPDATE users
SET image = NULL
WHERE image IS NOT NULL
  AND (
    image NOT LIKE 'https://%'
    OR image ~* '^https?://[^/]*@'                                       -- userinfo
    OR image ~* '^https?://localhost(:|/|$)'
    OR image ~* '^https?://[^/:]*\.(local|internal)(:[0-9]+)?(/|$)'      -- .local / .internal suffix
    OR image ~* '^https?://(0|127|10|192\.168|169\.254)\.[0-9]'        -- private/loopback IPv4 prefixes (followed by digit octet)
    OR image ~* '^https?://172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]'         -- 172.16/12 private range
    OR image ~* '^https?://(0x[0-9a-f]+|[0-9]+)(:|/|$)'                  -- numeric IPv4
    OR image ~* '^https?://\['                                           -- bare IPv6
    OR length(image) > 500
  );
