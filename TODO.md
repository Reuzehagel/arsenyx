# TODO

## Cloudflare Pages → Workers cutover (web)

Live on Workers Static Assets as `arsenyx-web` since 2026-04-29. Verified: SPA fallback, `_headers` cache rules, apex + www domains all serving correctly.

- [ ] Delete the old Pages `arsenyx` project (CF dashboard → Pages → arsenyx → Settings → Delete). Wait a few days for a rollback window if cautious.

## Bugs

- [ ] Add riven mod support to Overframe import
- [ ] Kuva/Tenet/Coda bonus element — flow selected element into `calculateWeaponStats` so picking one actually changes the damage numbers (dropdown + codec already wired; see [apps/web/src/lib/stats/weapon.ts](apps/web/src/lib/stats/weapon.ts))
- [ ] Check exalted weapons

## Performance

High-impact (seconds of improvement on browse/build pages):

- [ ] **Move WFCD images to R2** — today `getImageUrl` ([apps/web/src/lib/warframe.ts:12](apps/web/src/lib/warframe.ts:12)) points at `cdn.warframestat.us/img/*`, which 301-redirects to `raw.githubusercontent.com` (~290ms redirect overhead per image, GitHub raw sets `Cache-Control: max-age=300` and is often a MISS). Sync the image set to an R2 bucket on a custom domain (e.g. `img.arsenyx.com`), serve with `Cache-Control: public, max-age=31536000, immutable`. Add a `bun run sync:images` step alongside the existing data sync. Swap `WFCD_CDN_BASE`.
- [ ] **Convert images to WebP/AVIF during the R2 sync** — ~50-70% size reduction over the current 100KB PNGs.
- [ ] **Generate 128/256/512 variants and use `srcset`** — browse grid currently downloads 512×512 PNGs into a 128px slot. 4× smaller payload for grids.

Small wins (tens of ms):

- [ ] **Convert `apps/web/public/mod-components/*.png` (906KB, 57 files) to WebP** at build time. Saves ~600KB on first editor open.
- [ ] **Fingerprint `/data/*.json` filenames** at build time (e.g. `mods-all.{hash}.json`) and switch [apps/web/public/_headers](apps/web/public/_headers) `/data/*` rule from `max-age=300` to `immutable`. Eliminates the 5-min revalidation round-trip. Check whether anything outside the web app depends on the stable URLs (screenshot service, external integrations) before fingerprinting.

Skip / not worth it:

- Lazy-loading CommandPalette — only saves ~15KB over the wire; main bundle is already 210KB brotli.
- Vendor `manualChunks` — reverted previously per [apps/web/vite.config.ts:22](apps/web/vite.config.ts:22), bloated modulepreloads.

## Incarnon

- [ ] **Conditional damage math for incarnon perks** — picked perks (and Incarnon Form alt-fire mode) feed into stat calculations. Most perks are conditional triggers (on-headshot, on-reload, etc.), so this lands with the broader conditional-damage rework. See [apps/web/src/lib/stats/weapon.ts](apps/web/src/lib/stats/weapon.ts) and [packages/shared/src/warframe/incarnon-data.ts](packages/shared/src/warframe/incarnon-data.ts).
- [ ] **`hasIncarnon` flag on builds + filter** — add `hasIncarnon Boolean` column to the `Build` model (mirrors `hasShards`/`hasGuide`), populate in [apps/api/src/routes/builds.ts](apps/api/src/routes/builds.ts) on create/update from `buildData.incarnonEnabled`, add filter param in [apps/api/src/routes/_build-list.ts](apps/api/src/routes/_build-list.ts), then expose in [apps/web/src/lib/builds-list-query.ts](apps/web/src/lib/builds-list-query.ts) and add a "Has Incarnon" filter chip + a small badge on [apps/web/src/components/builds/build-card.tsx](apps/web/src/components/builds/build-card.tsx).
