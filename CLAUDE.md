# CLAUDE.md — Arsenyx

Warframe build planner. Create, share, discover equipment builds. Live at [www.arsenyx.com](https://www.arsenyx.com).

Game data (items, mods, arcanes) is static JSON precomputed at build time and served from the CDN under `apps/web/public/data/`. User data (builds, votes, favorites) lives in Postgres via the API.

## Deployment

- Web (Vite SPA) → Cloudflare Pages, `www.arsenyx.com` + `arsenyx.com`
- API (Hono on Workers) → `api.arsenyx.com`, Prisma 7 + `@prisma/adapter-neon` (workerd runtime)
- DB → Neon Postgres, EU (`eu-central-1`)
- Screenshot service → homelab Docker via Cloudflare Tunnel
- CI deploys both apps on push to `main` (prod branch). Secrets live in the CF dashboard, not in `.env`.

## Monorepo

Bun workspaces. **Never use npm/npx.**

- `apps/web/` — Vite + React 19 + TanStack Router + Tailwind v4 + shadcn/ui → see [apps/web/CLAUDE.md](apps/web/CLAUDE.md)
- `apps/api/` — Hono + Prisma 7 + Better Auth + Postgres → see [apps/api/CLAUDE.md](apps/api/CLAUDE.md)
- `packages/shared/` — types/codecs shared by web and api (`@arsenyx/shared/*`)
- `services/screenshot/` — standalone Playwright screenshot service (homelab Docker)

Run: `just dev` (web + api), `just web`, `just api`.

## Architecture

Game data is static, user data is dynamic. If something is read-heavy and rarely changes, emit it as a file under `apps/web/public/data/` — don't add an API route for it.

## Boundaries

**Always**
- `bun run build` in `apps/web/` and `bunx tsc --noEmit` in `apps/api/` before claiming done — dev servers hide type errors
- `just check` (oxlint + oxfmt) touched files before committing; `just fix` auto-applies
- Use `uv run python` instead of `python`/`python3`

**Ask first**
- Adding new dependencies
- Schema changes that drop/rename columns or add required fields

**Never**
- Modify `apps/web/src/components/ui/` — override via `className` instead

## Progressive disclosure — load on demand

- [TODO.md](TODO.md) — open bugs, deploy steps
- [docs/commands.md](docs/commands.md) — full command reference (build, db, data sync)
- [docs/gotchas.md](docs/gotchas.md) — non-obvious pitfalls (PowerShell, Base UI, shadcn in monorepo)
- [docs/off-cloudflare.md](docs/off-cloudflare.md) — inventory of CF-Workers-specific decisions + what would change if we ever migrate
- [apps/web/docs/rules/](apps/web/docs/rules/) — TanStack Router rules (per-topic)

## Keeping docs fresh

These files (`CLAUDE.md`, `apps/*/CLAUDE.md`, `docs/*.md`) are infrastructure — a stale line cascades into bad plans. **If you notice something here is wrong, out of date, or missing, update it directly** in the same session. Prefer deleting stale content over leaving it to rot. Prefer pointers (`file:line`) over embedded snippets.
