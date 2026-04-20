# TODO

## Bugs

- [ ] Add riven mod support to Overframe import

## Polish

- [ ] Keyboard navigation in browse grid (arrow keys, enter, focus ring)
- [ ] Mobile nav (hamburger + sheet)
- [ ] Split frontend bundle — route-level code splitting to get under the 500KB Vite warning

## Deploy

- [ ] `apps/web` → Cloudflare Pages (or similar EU-friendly static host)
- [ ] `apps/api` → Cloudflare Workers (Hono native) — check Prisma compatibility, swap to Fly if Workers fights back
- [ ] Database → Neon EU region
- [ ] Screenshot service → Fly.io scale-to-zero machine
- [ ] Domain wiring, CORS, env vars
