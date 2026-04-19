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
- [x] Build codec moved to `packages/shared` (includes `getStatIndex`/`getStatByIndex` shard helpers)
- [x] Warframe types moved to `packages/shared` (items.ts loader stays backend)
- [x] Full mod/arcane/shard render (reuse Slice 6 editor in read-only mode)
- [x] Port tsvector search trigger + index as raw SQL migration (needed for Slice 5 search)

### Slice 5 — Build listing + social (reads)

- [x] `/builds` — public builds list (paginated, sort, full-text search, category filter)
- [x] `/builds/mine` — authored builds
- [x] `/bookmarks` — bookmarked builds
- [x] `/profile/[username]`
- [x] `/org/[slug]` — public org page (header, members grid, builds list)
- [x] Like + bookmark toggles (mutation endpoints)

### Slice 6 — Build authoring (the hard stuff)

- [x] `/create` shell — item sidebar, editor header, grid area
- [x] Mod grid — innate polarities, forma picker, click-to-place, selection, ranks
- [x] Compatible-mods search panel — filters, sort, dim-on-filter, used-state
- [x] Editor sidebar — abilities, archon shards, capacity, reactor toggle, stats
- [x] Arcane slots — click-to-open picker, +/- rank while hovered, click-out deselects
- [x] Polarity-aware mod drain (green/red badge, halved/×1.25 cost)
- [x] Riven editor (stat input for riven mods)
- [x] Helminth abilities (subsume picker in editor sidebar)
- [x] Zaw component editors
- [x] Stats panel — recalc from placed mods/arcanes (multi-attack weapons, damage breakdown, rivens, warframe abilities, companions, archwing suits, stat caps)
- [x] Conditional mod stats — Galvanized, on-kill, Hunter Munitions, etc. (show-max-stacks toggle); also picks up rarer riven stats (Status Duration, Damage to Faction, Projectile Speed, Punch Through, Ammo Max, Zoom, Recoil, Finisher Damage, Slide Attack, Channeling…)
- [x] Aura ignore-list — Corrosive Projection and similar affect enemies not the player; port legacy ignore set before adding any player-affecting auras
- [x] Save build (create) — `POST /builds`, `/create` page wired to Save button
- [x] Update build — `PATCH /builds/:slug`, editor hydrates from `?build=<slug>` and Save switches to PATCH for owner
- [x] `readOnly` prop threaded through ModSlot / ArcaneSlot / ItemSidebar for `/builds/$slug`
- [x] Delete / fork build mutations
- [x] `/import` — Overframe import
  - [x] Server scraper — `POST /imports/overframe` extracts `__NEXT_DATA__`, resolves Overframe IDs to names via bundled items.csv, returns raw slot data + warnings
  - [x] `/import` page — URL input, preview of parsed result
  - [x] Client matching — item/mod/arcane/helminth against WFCD data, slot_id interpretation by category
  - [x] Editor handoff via sessionStorage draft — `/create?item=&category=&draft=` hydrates pre-populated state
  - [x] Forma-polarity detection via per-item JSON (aura + polarities)
  - [x] Wire `build-codec` into `/create` (`?share=<encoded>` loader) + Share button — codec in `@arsenyx/shared/warframe/build-codec`, adapter in `apps/web/src/lib/build-codec-adapter.ts`

### Slice 7 — Org + admin + settings

- [ ] `/settings` — profile, API keys (Organizations tab landed via existing SettingsDialog)
- [x] `/org/[slug]/settings` — org management (general, members, delete)
- [x] `/admin` — admin panel (users, content, orgs, stats)
- [x] Organizations CRUD (create, update, delete, add/remove member, role change)
- [ ] Wire `Build.organizationId` into `/create` editor so builds can publish under an org

### Slice 8 — Public API + screenshot service

- [ ] `/api/v1/builds` — public builds list
- [ ] `/api/v1/builds/[slug]` — public build detail
- [ ] `/api/v1/imports/overframe` — public import endpoint
- [ ] API keys: list/create/revoke flow
- [ ] Screenshot service — separate Fly machine with real Playwright (replaces chromium-min Vercel-serverless hack)
- [ ] OG image endpoint — Satori + resvg in Hono route

### Header polish (pulls in as slices land)

- [x] Search command (Ctrl+K palette)
- [x] UserMenu (sign in, avatar, sign out, settings)
- [ ] Mobile nav (hamburger + sheet)

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
- [x] Write `apps/web/CLAUDE.md` and `apps/api/CLAUDE.md`
- [ ] Split frontend bundle — route-level code splitting to get under the 500KB Vite warning
