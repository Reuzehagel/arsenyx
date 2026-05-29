# CLAUDE.md — apps/api

Hono on Cloudflare Workers (Bun-compatible for local dev). Better Auth + Prisma 7 (`@prisma/adapter-neon`, `workerd` runtime) + Neon Postgres. Locally on `:8787`, deployed to `api.arsenyx.com`. Serves **user data only** — game data is static JSON under `apps/web/public/data/`.

## Conventions

- Each domain is a sub-`Hono()` app exported from `src/routes/<name>.ts`, mounted via `app.route("/<name>", sub)` in [src/index.ts](src/index.ts). Files prefixed `_` (e.g. `_build-list.ts`) are shared helpers, not mounted.
- Build list queries (`/builds`, `/users/:username`, `/bookmarks`) go through [src/routes/_build-list.ts](src/routes/_build-list.ts) — extend `parseListQuery` / `runList`, don't hand-roll.
- Visibility enforcement for builds is centralised in [src/routes/builds.ts](src/routes/builds.ts). Slug generation uses `nanoid` with a URL-safe alphabet (no `0/O/1/l/I`).
- Better Auth mounts at `/auth/*`. Session in a handler: `await auth.api.getSession({ headers: c.req.raw.headers })`. `trustedOrigins` is driven by the `WEB_ORIGIN` env var (same list feeds Hono CORS).
- Shared cross-cut types live in `packages/shared`, imported as `@arsenyx/shared/*`. If both web and api need it, put it there — don't duplicate.

## Prisma

- Schema: [prisma/schema.prisma](prisma/schema.prisma) (single file). Generator has `runtime = "workerd"` — emits the `wasm-compiler-edge` runtime so the bundle works on Workers (no `fileURLToPath`, no `node:fs` at init).
- Dev uses `bun run db:push`. Destructive migrations go in [scripts/migrations/](scripts/migrations/) as dated `.sql` files applied manually against Neon via `prisma db execute --file`.
- Prisma 7 quirk: datasource `url` lives in [prisma.config.ts](prisma.config.ts), not the schema file.
- Generator output: `src/generated/prisma` (gitignored). Import as `import { Prisma } from "../generated/prisma/client"`.
- **PrismaClient is request-scoped** via `AsyncLocalStorage` in [src/db.ts](src/db.ts) — Workers reuses isolates across requests and the Neon Pool is request-scoped, so a module-level singleton leaks I/O between requests. Routes keep `import { prisma }` unchanged (Proxy reads the per-request client); the fetch handler in [src/index.ts](src/index.ts) wraps everything in `withPrisma`.

## Env

Local secrets live in a **single file: `apps/api/.env`** (gitignored — copy from [.env.example](.env.example)). Three toolchains read it:

- `wrangler dev` (the local API server, `bun run dev`) — Wrangler 4.x loads `.env` into the Worker's `env` bindings automatically (boot log: "Using secrets defined in .env"). **Do not add a `.dev.vars` file**: if present it *overrides and suppresses* `.env` entirely, reintroducing the drift this setup avoids. (`CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false` disables `.env` loading.)
- Prisma (`db:push` / `db:studio` / `db:generate`) via [prisma.config.ts](prisma.config.ts) (dotenv).
- The `bun run` scripts (e.g. `seed-admin`) via `dotenv` / bun's auto-load.

Keys: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, `NODE_ENV`, `WEB_ORIGIN`.

Prod injects secrets via `wrangler secret put` (see [wrangler.toml](wrangler.toml) for the list). Plaintext vars (`WEB_ORIGIN`, `BETTER_AUTH_URL`, `NODE_ENV`) live in `wrangler.toml`'s `[vars]` block. **Don't branch on `NODE_ENV`** to pick credentials; do use it for cookie `SameSite`/`Secure` gates.

## Boundaries

**Always**
- `bunx tsc --noEmit` before claiming done
- `bun run db:generate` (or `db:push`) after schema changes
- Use `bun` / `bunx`, never `npm` / `npx`

**Never**
- Import `apps/web/*` — only `@arsenyx/shared` crosses the boundary
- Commit `src/generated/`
- Hand-roll a build list query — use `_build-list.ts`

## Keeping this file fresh

If anything here is stale or missing, update it. See [root CLAUDE.md](../../CLAUDE.md#keeping-docs-fresh).
