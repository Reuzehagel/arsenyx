# TODO

## Bugs

- [ ] Add riven mod support to Overframe import

## Rewrite (Next.js → Vite + TanStack Router + Hono)

See [docs/migration-inventory.md](docs/migration-inventory.md) for the full inventory.

Work happens on the `rewrite` branch (tracks `origin/rewrite`). Legacy Next.js app still runs side-by-side via `just legacy` (or `just legacy-nodb` without Docker); new stack via `just web` / `just dev`.

### Done

- [x] Bun workspaces monorepo scaffold (`apps/web`, `apps/api`, `packages/shared`, `legacy/`)
- [x] Homepage (hero, features, CTA, footer, simplified header)
- [x] `/browse` — static items index (~200KB), category tabs, search, grid
- [x] `/browse` — sort dropdown (name A-Z, Z-A, newest, oldest)
- [x] `/browse` — filter dropdown (mastery slider, prime-only, hide vaulted)
- [x] `/about`, `/privacy`, `/terms`, `/changelog`
- [x] Theme toggle (light/dark/system dropdown, no flash of wrong theme)
- [x] Fix exalted weapons excludeFromCodex bug in categorization
- [x] `/browse/[category]/[slug]` item detail page (per-item static JSON)

### Slice 2c — Browse polish

- [ ] Keyboard navigation in browse grid (arrow keys, enter, focus ring)
- [ ] Vaulted badge polish / primed indicator

### Slice 3 — Auth foundation

- [x] Better Auth on Hono middleware (`apps/api`)
- [x] GitHub OAuth handshake
- [x] `/auth/signin` page
- [x] `/auth/error` page
- [x] UserMenu (Header right side, replaces ThemeToggle-only layout)
- [x] Better Auth React client + session hook in `apps/web`
- [x] Neon dev branch connection string wired into `apps/api/.env`
- [x] GitHub OAuth app created + credentials in `apps/api/.env`
- [x] First `bunx prisma db push` against the new branch
- [x] CORS + cookies — chose same-origin (SPA + `/api/*` proxy on one domain); no CORS middleware needed

### Slice 4 — Build view (first real content page needing backend)

- [x] Prisma schema moved into `apps/api/prisma/schema.prisma` and pushed to Neon dev
- [x] Hono route: `GET /builds/:slug` with visibility checks (owner / public / unlisted / org member)
- [x] `/builds/$slug` route in web (loader + query + minimal render)
- [x] Markdown guide rendering (react-markdown + remark-gfm) — rehype-highlight deferred
- [ ] Build codec moved to `packages/shared`
- [ ] Warframe types moved to `packages/shared` (items.ts loader stays backend)
- [ ] Full mod/arcane/shard render (reuse Slice 6 editor in read-only mode)
- [ ] Port tsvector search trigger + index as raw SQL migration (needed for Slice 5 search)

### Slice 5 — Build listing + social (reads)

- [ ] `/builds` — public builds list (paginated)
- [ ] `/builds/mine` — authored builds
- [ ] `/favorites` — favorited builds
- [ ] `/profile/[username]`
- [ ] `/org/[slug]`
- [ ] Vote + favorite toggles (mutation endpoints)

### Slice 6 — Build authoring (the hard stuff)

- [x] `/create` shell — item sidebar, editor header, grid area
- [x] Mod grid — innate polarities, forma picker, click-to-place, selection, ranks
- [x] Compatible-mods search panel — filters, sort, dim-on-filter, used-state
- [x] Editor sidebar — abilities, archon shards, capacity, reactor toggle, stats
- [x] Arcane slots — click-to-open picker, +/- rank while hovered, click-out deselects
- [x] Polarity-aware mod drain (green/red badge, halved/×1.25 cost)
- [x] Riven editor (stat input for riven mods)
- [x] Helminth abilities (subsume picker in editor sidebar)
- [ ] Zaw component editors
- [x] Stats panel — recalc from placed mods/arcanes (multi-attack weapons, damage breakdown, rivens, warframe abilities, companions, archwing suits, stat caps)
- [ ] Conditional mod stats — Galvanized, on-kill, Hunter Munitions, etc. (show-max-stacks toggle); also picks up rarer riven stats (Status Duration, Damage to Faction, Projectile Speed, Punch Through, Ammo Max, Zoom, Recoil, Finisher Damage, Slide Attack, Channeling…)
- [ ] Aura ignore-list — Corrosive Projection and similar affect enemies not the player; port legacy ignore set before adding any player-affecting auras
- [x] Save build (create) — `POST /builds`, `/create` page wired to Save button
- [x] Update build — `PATCH /builds/:slug`, editor hydrates from `?build=<slug>` and Save switches to PATCH for owner
- [x] `readOnly` prop threaded through ModSlot / ArcaneSlot / ItemSidebar for `/builds/$slug`
- [ ] Delete / fork build mutations
- [ ] `/import` — Overframe import

### Slice 7 — Org + admin + settings

- [ ] `/settings` — profile, API keys
- [ ] `/org/[slug]/settings` — org management
- [ ] `/admin` — admin panel (ban user, delete build, etc.)
- [ ] Organizations CRUD (create, add/remove member, role change)

### Slice 8 — Public API + screenshot service

- [ ] `/api/v1/builds` — public builds list
- [ ] `/api/v1/builds/[slug]` — public build detail
- [ ] `/api/v1/imports/overframe` — public import endpoint
- [ ] API keys: list/create/revoke flow
- [ ] Screenshot service — separate Fly machine with real Playwright (replaces chromium-min Vercel-serverless hack)
- [ ] OG image endpoint — Satori + resvg in Hono route

### Header polish (pulls in as slices land)

- [ ] Search command (Ctrl+K palette)
- [ ] Mobile nav (hamburger + sheet)
- [ ] UserMenu (after auth)

### Deploy

- [ ] `apps/web` → Cloudflare Pages (or similar EU-friendly static host)
- [ ] `apps/api` → Cloudflare Workers (Hono native) — check Prisma compatibility, swap to Fly if Workers fights back
- [ ] Database → Neon EU region
- [ ] Screenshot service → Fly.io scale-to-zero machine
- [ ] Domain wiring, CORS, env vars

### Cleanup (after web feature parity)

- [ ] Delete `legacy/`
- [x] Move `build-items-index.ts` out of legacy → root `scripts/`, backed by `packages/shared/warframe`
- [ ] Update root CLAUDE.md to reflect new architecture (Next.js references)
- [ ] Write `apps/web/CLAUDE.md` and `apps/api/CLAUDE.md`
- [ ] Split frontend bundle — route-level code splitting to get under the 500KB Vite warning
