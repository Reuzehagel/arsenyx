# Commands

Bun only — never `npm` / `npx`.

## Dev

```bash
just dev                # web + api together (default)
just web                # Vite SPA only (http://localhost:5173)
just api                # Hono API only (http://localhost:8787)
just stop               # kill dev servers on :5173 / :5174 / :8787
just setup              # first-run wizard — see CONTRIBUTING.md
```

## Build / verify

```bash
bun --cwd apps/web run build      # Vite production build — run before claiming done
bunx --cwd apps/api tsc --noEmit  # type-check the API (no dev-server smoke)
just check                        # typecheck + oxlint + oxfmt --check (also generates routeTree.gen.ts if missing)
just gen                          # generate apps/web/src/routeTree.gen.ts only (no-op if present)
just fix                          # oxlint --fix + oxfmt --write
just test                         # vitest across apps/web, apps/api, packages/shared
```

Oxlint / oxfmt config lives at the repo root (`.oxlintrc.json`, `.oxfmtrc.json`).

## Database (apps/api)

Postgres is on Neon — no local Postgres process. Connection string lives in `apps/api/.env`.

```bash
bun --cwd apps/api run db:push     # dev: push schema without migrations
bun --cwd apps/api run db:studio   # Prisma Studio GUI
bun --cwd apps/api run db:generate # regenerate Prisma client
```

## Data pipeline

```bash
just build-items-index             # regenerate apps/web/public/data/ (items-index.json + per-item JSON)
just update-data                   # bump @wfcd/items, then rebuild
```

## Shadcn (apps/web)

```bash
cd apps/web && bunx shadcn@latest view <name>      # inspect
cd apps/web && bunx shadcn@latest add <name> -c .  # add to apps/web
```

See [gotchas.md](gotchas.md#shadcn-in-the-monorepo) for the monorepo workaround.
