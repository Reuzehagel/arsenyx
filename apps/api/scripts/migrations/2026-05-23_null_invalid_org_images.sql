-- Null out organization image URLs that don't pass the validator added in
-- apps/api/src/lib/validate.ts (validateExternalUrl). Pre-existing rows were
-- written before validation existed, so any could still be a non-https URL
-- pointing at an attacker-controlled host whose access logs harvest visitor
-- IPs + Referer headers on avatar load.
--
-- New writes are validated server-side; this catches the back-fill. Admins
-- whose legitimate logo gets nulled can re-upload via the org settings page.
--
-- Scope: only rejects the obvious bad shapes (non-https, private/internal
-- hostnames, userinfo). The web-side Cloudflare Image Resizing proxy is the
-- second line of defence — it makes the source fetch happen from CF's
-- network rather than the visitor's browser regardless of what's stored.
--
-- Run against Neon (from apps/api/):
--   bunx prisma db execute --file scripts/migrations/2026-05-23_null_invalid_org_images.sql

UPDATE organizations
SET image = NULL
WHERE image IS NOT NULL
  AND (
    image NOT LIKE 'https://%'
    OR image ~* '^https?://[^/]*@'                                       -- userinfo
    OR image ~* '^https?://localhost(:|/|$)'
    OR image ~* '^https?://[^/:]*\.(local|internal)(:[0-9]+)?(/|$)'      -- .local / .internal as actual hostname suffix
    OR image ~* '^https?://(0\.|127\.|10\.|192\.168\.|169\.254\.)'
    OR image ~* '^https?://172\.(1[6-9]|2[0-9]|3[0-1])\.'
    OR image ~* '^https?://(0x[0-9a-f]+|[0-9]+)(:|/|$)'                  -- numeric-IPv4 (decimal/hex)
    OR image ~* '^https?://\['                                           -- bare IPv6
    OR length(image) > 500
  );
