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

### Slice 2c — Browse polish

- [ ] `/browse/[category]/[slug]` item detail page (per-item static JSON or Hono route)
- [ ] Keyboard navigation in browse grid (arrow keys, enter, focus ring)
- [ ] Vaulted badge polish / primed indicator

### Slice 3 — Auth foundation

- [ ] Better Auth on Hono middleware (`apps/api`)
- [ ] GitHub OAuth handshake
- [ ] `/auth/signin` page
- [ ] `/auth/error` page
- [ ] UserMenu (Header right side, replaces ThemeToggle-only layout)
- [ ] Better Auth React client + session hook in `apps/web`
- [ ] Neon dev Postgres (EU region) — one-time setup to unblock auth
- [ ] CORS + cookies across `web.arsenyx` and `api.arsenyx` (or same-parent-domain)

### Slice 4 — Build view (first real content page needing backend)

- [ ] Prisma schema + migrations live in `apps/api` (moved from `legacy/`)
- [ ] Hono route: `GET /builds/:slug` with visibility checks
- [ ] `/builds/[slug]` route in web (loader + query + render)
- [ ] Markdown guide rendering (react-markdown + remark-gfm + rehype-highlight)
- [ ] Build codec moved to `packages/shared`
- [ ] Warframe types moved to `packages/shared` (items.ts loader stays backend)

### Slice 5 — Build listing + social (reads)

- [ ] `/builds` — public builds list (paginated)
- [ ] `/builds/mine` — authored builds
- [ ] `/favorites` — favorited builds
- [ ] `/profile/[username]`
- [ ] `/org/[slug]`
- [ ] Vote + favorite toggles (mutation endpoints)

### Slice 6 — Build authoring (the hard stuff)

- [ ] `/create` — new build flow
- [ ] Build editor (`src/components/build-editor/`)
- [ ] Mod slot editor + riven editor
- [ ] Save / delete / fork build mutations
- [ ] Helminth, zaw, polarity editors
- [ ] Stats panel (recalc on change)
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
- [ ] Consolidate `build-items-index.ts` into `apps/api` or a root `scripts/`
- [ ] Update root CLAUDE.md to reflect new architecture (Next.js references)
- [ ] Write `apps/web/CLAUDE.md` and `apps/api/CLAUDE.md`
- [ ] Split frontend bundle — route-level code splitting to get under the 500KB Vite warning
