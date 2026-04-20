# CLAUDE.md — apps/api

Hono on Bun. Better Auth + Prisma 7 (PrismaPg adapter) + Postgres. Listens on `:8787`. Serves **user data only** — game data is static JSON under `apps/web/public/data/`.

## Conventions

- Each domain is a sub-`Hono()` app exported from `src/routes/<name>.ts`, mounted via `app.route("/<name>", sub)` in [src/index.ts](src/index.ts). Files prefixed `_` (e.g. `_build-list.ts`) are shared helpers, not mounted.
- Build list queries (`/builds`, `/users/:username`, `/bookmarks`) go through [src/routes/_build-list.ts](src/routes/_build-list.ts) — extend `parseListQuery` / `runList`, don't hand-roll.
- Visibility enforcement for builds is centralised in [src/routes/builds.ts](src/routes/builds.ts). Slug generation uses `nanoid` with a URL-safe alphabet (no `0/O/1/l/I`).
- Better Auth mounts at `/auth/*`. Session in a handler: `await auth.api.getSession({ headers: c.req.raw.headers })`. `trustedOrigins` is driven by the `WEB_ORIGIN` env var (same list feeds Hono CORS).
- Shared cross-cut types live in `packages/shared`, imported as `@arsenyx/shared/*`. If both web and api need it, put it there — don't duplicate.

## Prisma

- Schema: [prisma/schema.prisma](prisma/schema.prisma) (single file). **Dev workflow is `bun run db:push`, never `migrate`** — migrations are deferred until prod.
- Prisma 7 quirk: datasource `url` lives in [prisma.config.ts](prisma.config.ts), not the schema file.
- Generator output: `src/generated/prisma` (gitignored). Import as `import { Prisma } from "../generated/prisma/client"`.
- `db.ts` uses `PrismaPg` with `max: 3` for Neon's pooler + scale-to-zero.

## Env

`.env` is the only source; prod injects the same var names via host secrets (Cloudflare/Fly). **Don't branch on `NODE_ENV`** to pick credentials. Required keys are in [`.env.example`](.env.example).

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
