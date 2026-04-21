# TODO

## Bugs

- [ ] Add riven mod support to Overframe import
- [x] Fix companions
- [x] Fix Lich weapons
- [ ] Kuva/Tenet/Coda bonus element — flow selected element into `calculateWeaponStats` so picking one actually changes the damage numbers (dropdown + codec already wired; see [apps/web/src/lib/stats/weapon.ts](apps/web/src/lib/stats/weapon.ts))
- [x] Fix Necramech
- [x] Fix Jade
- [ ] Check exalted weapons

## Polish

- [ ] Mobile nav (hamburger + sheet)
- [x] Split frontend bundle — route-level code splitting to get under the 500KB Vite warning
