# Migrating off Cloudflare Workers

A catalogue of every Cloudflare-Workers-specific decision in the codebase, why it exists, and what changes if we move the API to a different runtime (Node, Deno, Bun on a VPS, Fly.io, Railway, Render, etc.). Not a plan — a reference for the day we need one.

## TL;DR

The API is a [Hono](https://hono.dev/) app deployed to Cloudflare Workers. Workers is opinionated — it runs [workerd](https://github.com/cloudflare/workerd), not Node. That opinion bleeds into four places:

1. **Prisma generator runtime** — `runtime = "workerd"` in [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma).
2. **Local dev harness** — `wrangler dev` (workerd), not `bun run` (would work if not for Prisma).
3. **Two env files** — `.env` (Prisma CLI) + `.dev.vars` (wrangler).
4. **Workers primitives in app code** — `ctx.waitUntil`, Workers-typed handlers, `[vars]`/secrets split in wrangler.toml.

Everything else (Hono, Better Auth, Neon Postgres, the web SPA) is runtime-agnostic and wouldn't change.

## The four CF-specific things

### 1. Prisma client runtime

[apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma):

```prisma
generator client {
  provider = "prisma-client"
  runtime  = "workerd"
  output   = "../src/generated/prisma"
}
```

`runtime = "workerd"` produces a client that loads its query compiler as a WASM module via the wrangler-specific `import "./foo.wasm?module"` syntax. **That client cannot run under plain Bun or Node** — the error is `first argument to WebAssembly.Instance must be a WebAssembly.Module`. This is the single biggest cause of local-dev friction today.

Off-CF migration:

- Change `runtime = "nodejs"` (or remove — nodejs is the default).
- Run `bun run db:generate`.
- Remove `@prisma/adapter-neon`, use the default Prisma node driver (or Neon's node driver if we stay on Neon).
- Drop the workerd-specific WASM import headaches entirely.

**Known Prisma 7 + Workers gotcha to be aware of if we stay:** [prisma/prisma#28657](https://github.com/prisma/prisma/issues/28657) — "Wasm code generation disallowed by embedder" can surface on Workers with certain client versions. Current workaround is downgrading to Prisma 6.19.0. Deploy is working for us on 7.7.0 today; monitor that issue.

### 2. Local dev uses wrangler, not Bun

[apps/api/package.json](../apps/api/package.json):

```json
"dev": "wrangler dev"
```

Because of (1), we can't run the API under `bun run --hot`. wrangler dev boots a local workerd (~5-15s cold start, ~500ms hot reload).

Off-CF migration:

- Swap `"dev": "wrangler dev"` → `"dev": "bun run --hot src/index.ts"` (or Node equivalent).
- Drop wrangler from devDependencies.
- Hot reload becomes Bun-native (faster).

### 3. Two env files (`.env` + `.dev.vars`)

This is the canonical Cloudflare + Prisma pattern — see [better-hono starter](https://github.com/alwaysnomads/better-hono) and [Hono's Better Auth on Cloudflare example](https://hono.dev/examples/better-auth-on-cloudflare). The split exists because:

- Prisma CLI (`bunx prisma db push`, generate) reads `.env` via dotenv.
- wrangler dev reads `.dev.vars` only — it **does not read `.env`**.

The [setup wizard](../scripts/setup.ts) writes both files with identical content to paper over this.

Off-CF migration:

- Delete `.dev.vars` (and the wizard's write of it).
- Single `.env` is enough.
- Remove the `.dev.vars` gitignore entry.

### 4. Workers primitives in app code

- **`ctx.waitUntil`** — [apps/api/src/db.ts](../apps/api/src/db.ts) uses this to keep the per-request Prisma client alive while background work (e.g. `lastUsedAt` bumps) settles. Workers-specific API. Node/Bun have no equivalent; you'd either `await` the cleanup inline, or register a process-level promise tracker.
- **Fetch-style handler** — [apps/api/src/index.ts](../apps/api/src/index.ts) exports `{ fetch(req, env, ctx) }`. Under Node/Bun you'd use Hono's `serve()` adapter, which exposes `req` only — no `env`, no `ctx`.
- **Secret injection** — Workers injects secrets via `env` param, not `process.env`. Today some code reads `process.env` (Node compat is enabled via `compatibility_flags = ["nodejs_compat"]`), some reads `env` — inconsistent. A migration is a good moment to consolidate on `process.env`.
- **[wrangler.toml](../apps/api/wrangler.toml)** — the deployment manifest. `[vars]`, secrets (`wrangler secret put`), routes, observability are all CF-specific.

Off-CF migration:

- Rewrite the per-request Prisma scope to drop `ctx.waitUntil`. Either `await` the cleanup at the end of the request handler, or accept that disconnect happens lazily.
- Swap the fetch handler shape to Hono's Node/Bun adapter (`import { serve } from "@hono/node-server"` or `Bun.serve`).
- Move secrets to environment variables / a secrets manager appropriate to the target platform (Fly secrets, Railway env, Docker env, etc.).
- Delete wrangler.toml.

## Runtime-agnostic pieces (no change needed)

- **[Hono](https://hono.dev/)** — explicitly multi-runtime. Same app code runs on Node, Bun, Deno, Workers, Lambda.
- **Better Auth** — framework-agnostic. Runs anywhere.
- **Neon Postgres** — works from any runtime via `@prisma/adapter-neon` (fetch-based) or the standard `pg` driver. If we leave CF we can keep Neon or move to any Postgres host.
- **The web SPA (Vite)** — Cloudflare Pages is just a static host. Any CDN / static host works (Vercel, Netlify, Fly static, S3+CloudFront).

## What we'd lose / gain

**Lose**:
- Free tier + global edge — Workers routes ~every request via the nearest CF POP.
- Zero-cold-start invocation.
- Built-in DDoS protection at the edge.

**Gain**:
- A normal dev loop. Bun or Node hot reload is ~instant; no wrangler startup tax.
- No Prisma-workerd landmines.
- Single `.env`. No `.dev.vars`.
- `ctx.waitUntil` goes away. Long-running tasks (background writes) become natural.

## Alternative stack if we did a bigger rewrite

[better-hono](https://github.com/alwaysnomads/better-hono) uses Hono + Better Auth + **Drizzle** + Workers + Bun. Drizzle is Workers-native and dodges the Prisma-on-Workers friction entirely. If we ever do a migration, evaluating Drizzle as the Prisma replacement is worth a few hours — same schema-first style, much smaller runtime footprint, no WASM engine.

## File-level inventory (what a migration PR would touch)

| File | Change |
|------|--------|
| [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma) | `runtime = "workerd"` → remove (defaults to nodejs) |
| [apps/api/package.json](../apps/api/package.json) | `"dev": "wrangler dev"` → `"bun run --hot src/index.ts"`; drop `wrangler`, `@prisma/adapter-neon` deps; optionally swap `@prisma/adapter-neon` → `pg` |
| [apps/api/src/db.ts](../apps/api/src/db.ts) | Drop `ctx.waitUntil` pattern; simplify `withPrisma` |
| [apps/api/src/index.ts](../apps/api/src/index.ts) | Swap `export default { fetch }` → `serve(app)` or `Bun.serve({ fetch: app.fetch })` |
| [apps/api/wrangler.toml](../apps/api/wrangler.toml) | Delete |
| [scripts/setup.ts](../scripts/setup.ts) | Stop writing `.dev.vars` |
| [.gitignore](../.gitignore) | Drop `.dev.vars` and `.wrangler/` entries |
| CI | `wrangler deploy` → whatever the new host uses |

## Triggers to re-read this doc

- Wrangler dev startup becomes unbearable on a teammate's machine.
- [prisma/prisma#28657](https://github.com/prisma/prisma/issues/28657) starts biting us in prod.
- CF pricing changes / egress surprises.
- We need long-running background work (websockets, queues with retries beyond the 30s Worker CPU limit).
