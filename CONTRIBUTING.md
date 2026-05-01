# Contributing

Thanks for poking around. Arsenyx is a Bun workspaces monorepo — no npm, no npx.

## Repo layout

- [`apps/web/`](apps/web/) — the SPA (Vite + React 19 + TanStack Router)
- [`apps/api/`](apps/api/) — the Hono API (Cloudflare Workers + Prisma 7)
- [`packages/shared/`](packages/shared/) — types and codecs shared by both

Game data is **static** and served as JSON from `apps/web/public/data/`. User data (builds, votes, favorites, guides) is **dynamic** and lives in Postgres behind the API.

## Running locally

Requires Bun 1.2+, [just](https://github.com/casey/just), and a free Neon Postgres project ([neon.tech](https://neon.tech) — 1 minute signup).

```bash
bun install
just setup    # interactive — asks for your Neon DATABASE_URL, generates
              # an auth secret, pushes the schema, and seeds a dev user.
just dev      # web on :5173, api on :8787
```

Sign in at `http://localhost:5173` with **`admin@admin.com`** / **`admin`**.

GitHub OAuth is optional locally — fill `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `apps/api/.env` if you want to test the real OAuth flow. **In production, GitHub OAuth is the only sign-in method**; email+password is dev-only.

The full command list is in the [justfile](justfile); [docs/commands.md](docs/commands.md) covers build, database, and data-sync workflows.

## Agent-assisted work

Start with [CLAUDE.md](CLAUDE.md) — it points to the per-app guides in [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) and [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md). Open work is tracked in [TODO.md](TODO.md).
