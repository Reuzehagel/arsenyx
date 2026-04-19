# Commands

Bun only — never `npm` / `npx`.

## Dev

```bash
just dev                # web + api together (default)
just web                # Vite SPA only (http://localhost:5173)
just api                # Hono API only (http://localhost:8787), starts Postgres
just legacy             # old Next.js app on :3000 (+ Postgres)
just legacy-nodb        # legacy without Docker
just stop               # kill dev servers on :5173 / :8787 / :3000
just setup              # first-run: install, start Postgres, db:push
```

## Build / verify

```bash
bun --cwd apps/web run build     # tsc -b && vite build — run before claiming done
bunx --cwd apps/api tsc --noEmit # type-check api
```

## Database (apps/api)

```bash
bun --cwd apps/api run db:push     # dev: push schema without migrations
bun --cwd apps/api run db:studio   # Prisma Studio GUI
bun --cwd apps/api run db:generate # regenerate Prisma client
```

Local Postgres runs in Docker via `docker compose up -d postgres` (started by `just api`). Prod env (Neon) is injected by the host — same var names, don't branch on `NODE_ENV`.

## Data pipeline

```bash
just build-items-index       # regenerate apps/web/public/data/ (items-index.json + per-item JSON)
bun run build:items          # same, from repo root
```

## Shadcn (apps/web)

```bash
cd apps/web && bunx shadcn@latest view <name>      # inspect
cd apps/web && bunx shadcn@latest add <name> -c .  # add to apps/web
```

See [gotchas.md](gotchas.md#shadcn-in-the-monorepo) for the monorepo workaround.
