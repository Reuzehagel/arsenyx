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

Sources (no npm dep): DE PublicExport JSON blobs (`data/raw/de/`) +
wiki Lua modules (`data/raw/wiki/`). The build merges them with the
curated overrides under `data/curated/`.

`data/raw/` is **gitignored** — it's a network mirror, not source. The built
catalog under `apps/web/public/data/` is what's committed and what ships, so a
plain clone runs the app fine. You only need the raw mirror to *rebuild* the
catalog: run `bun run data:sync` once on a fresh clone before `build:items`
(or just run `data:bump`, which syncs first).

```bash
bun run data:sync                  # mirror DE PublicExport + wiki Lua into data/raw/
bun run build:items                # regenerate apps/web/public/data/ (emits UPSTREAM image URLs)
bun run sync:images                # mirror emitted images into R2, rewrite catalog → img.arsenyx.com
bun run check:images               # guard (CI): fail if catalog still hotlinks content/wiki.warframe.com
just build-items-index             # build:items + sync:images — the everyday "rebuild" pair
bun run data:bump                  # data:sync + build:items + sync:images (full refresh; weekly CI cron)
```

`build:items` alone leaves upstream CDN URLs in the catalog; `sync:images`
mirrors the bytes into R2 and rewrites them to `img.arsenyx.com`. Always pair
them (use `just build-items-index`) — `check:images` blocks a hotlinked
catalog from merging. `sync:images` needs R2 creds in the root `.env` (see
`.env.example`); run via the build chain it self-skips when they're absent.

Occasional dev tools (run by path, not aliased):

```bash
bun run scripts/diff-index.ts <golden-dir> <new-dir>    # regression-diff two catalog snapshots
uv run --with pillow python scripts/tint-set-crests.py  # regenerate bronze/gold mod-set crests
```

## Shadcn (apps/web)

```bash
cd apps/web && bunx shadcn@latest view <name>      # inspect
cd apps/web && bunx shadcn@latest add <name> -c .  # add to apps/web
```

See [gotchas.md](gotchas.md#shadcn-in-the-monorepo) for the monorepo workaround.
