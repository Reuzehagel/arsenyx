# TODO

## Bugs

- [ ] Add riven mod support to Overframe import
- [x] Fix companions
- [ ] Fix Lich weapons
- [ ] Fix Necramech
- [ ] Fix Jade
- [ ] Check exalted weapons

## Polish

- [ ] Keyboard navigation in browse grid (arrow keys, enter, focus ring)
- [ ] Mobile nav (hamburger + sheet)
- [ ] Split frontend bundle — route-level code splitting to get under the 500KB Vite warning

## Deploy — done

- [x] `apps/web` → Cloudflare Pages
- [x] `apps/api` → Cloudflare Workers (Prisma 7 + `@prisma/adapter-neon`, workerd runtime)
- [x] Database → Neon EU (`eu-central-1`)
- [x] Domain wiring: `www.arsenyx.com` + `arsenyx.com` → Pages, `api.arsenyx.com` → Worker
- [x] CORS locked to production origins, cross-origin cookies (`SameSite=None; Secure`)

## Post-launch cleanup

- [ ] Delete Vercel project
- [ ] Retire `beta.arsenyx.com` (custom domain + DNS record) once staging is no longer useful
