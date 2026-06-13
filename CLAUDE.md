# CLAUDE.md — Arsenyx

Game data (items, mods, arcanes) is static JSON precomputed at build time and served from the CDN under `apps/web/public/data/`. User data (builds, likes, bookmarks) lives in Postgres.

## Deployment

- Web (Vite SPA) → Cloudflare Workers (Static Assets), `www.arsenyx.com` (canonical; the Worker 301s `arsenyx.com` → www). SPA fallback + cache headers via [apps/web/wrangler.toml](apps/web/wrangler.toml) and [apps/web/public/\_headers](apps/web/public/_headers). The edge Worker also injects per-page SEO meta — see [apps/web/CLAUDE.md](apps/web/CLAUDE.md).
- API (Hono on Workers) → `api.arsenyx.com`, Prisma 7 + `@prisma/adapter-pg` (workerd runtime)
- DB → PlanetScale Postgres, reached through Cloudflare Hyperdrive (see [apps/api/CLAUDE.md](apps/api/CLAUDE.md))
- CI deploys both Workers on push to `main` via Workers Builds (configured in the CF dashboard). Secrets live in the CF dashboard, not in `.env`.

## Monorepo

Bun workspaces. **Never use npm/npx.**

- `apps/web/` — Vite + React 19 + TanStack Router + Tailwind v4 + shadcn/ui → see [apps/web/CLAUDE.md](apps/web/CLAUDE.md)
- `apps/api/` — Hono + Prisma 7 + Better Auth + Postgres → see [apps/api/CLAUDE.md](apps/api/CLAUDE.md)
- `packages/shared/` — types/codecs shared by web and api (`@arsenyx/shared/*`)

## Architecture

Game data is static, user data is dynamic. If something is read-heavy and rarely changes, emit it as a file under `apps/web/public/data/` — don't add an API route for it.

## Boundaries

**Always**

- `bun run typecheck` (web + api + shared) before claiming done — `vite build` and dev servers don't typecheck, so web/shared type errors hide otherwise
- `just check` (typecheck + oxlint + oxfmt) touched files before committing; `just fix` auto-applies lint + format
- Use `uv run python` instead of `python`/`python3`

**Ask first**

- Adding new dependencies — don't skip this; actually discuss it with the user first
- Schema changes that drop/rename columns or add required fields

**Never**

- Modify `apps/web/src/components/ui/` — override via `className` instead
- Don't assume Warframe game-mechanic facts from memory. Mod compatibility, slot rules, ability behavior, drop sources, etc. drift between updates and the model's training data is unreliable here. Check [wiki.warframe.com](https://wiki.warframe.com) (via WebFetch) or the data files under `apps/web/public/data/` before encoding a rule into filters, validators, or hardcoded branches. If a fact can't be verified, say so instead of guessing.

## Progressive disclosure — load on demand

- [docs/commands.md](docs/commands.md) — full command reference (build, db, data sync)
- [docs/gotchas.md](docs/gotchas.md) — non-obvious pitfalls (PowerShell, Base UI, shadcn in monorepo)

## Keeping docs fresh

These files (`CLAUDE.md`, `apps/*/CLAUDE.md`, `docs/*.md`) are infrastructure — a stale line cascades into bad plans. **If you notice something here is wrong, out of date, or missing, update it directly** in the same session. Prefer deleting stale content over leaving it to rot. Prefer pointers (`file:line`) over embedded snippets.
