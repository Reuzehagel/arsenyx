# TODO

## Bugs

- [ ] Add riven mod support to Overframe import
- [ ] Kuva/Tenet/Coda bonus element — flow selected element into `calculateWeaponStats` so picking one actually changes the damage numbers (dropdown + codec already wired; see [apps/web/src/lib/stats/weapon.ts](apps/web/src/lib/stats/weapon.ts))
- [ ] Check exalted weapons

## Incarnon

- [ ] **Conditional damage math for incarnon perks** — picked perks (and Incarnon Form alt-fire mode) feed into stat calculations. Most perks are conditional triggers (on-headshot, on-reload, etc.), so this lands with the broader conditional-damage rework. See [apps/web/src/lib/stats/weapon.ts](apps/web/src/lib/stats/weapon.ts) and [packages/shared/src/warframe/incarnon-data.ts](packages/shared/src/warframe/incarnon-data.ts).
- [ ] **`hasIncarnon` flag on builds + filter** — add `hasIncarnon Boolean` column to the `Build` model (mirrors `hasShards`/`hasGuide`), populate in [apps/api/src/routes/builds.ts](apps/api/src/routes/builds.ts) on create/update from `buildData.incarnonEnabled`, add filter param in [apps/api/src/routes/_build-list.ts](apps/api/src/routes/_build-list.ts), then expose in [apps/web/src/lib/builds-list-query.ts](apps/web/src/lib/builds-list-query.ts) and add a "Has Incarnon" filter chip + a small badge on [apps/web/src/components/builds/build-card.tsx](apps/web/src/components/builds/build-card.tsx).
