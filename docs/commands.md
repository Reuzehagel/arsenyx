# Commands

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
just check                        # THE gate before claiming done — gen + typecheck + oxlint + oxfmt --check + check:native-button + tests
just fix                          # oxlint --fix + oxfmt --write
just test                         # vitest across apps/web, apps/api, packages/shared + bun test scripts/build/
just gen                          # generate apps/web/src/routeTree.gen.ts only (no-op if present)
bun --cwd apps/web run build      # Vite production build (does NOT typecheck — `just check` is the gate)
```

Oxlint / oxfmt config lives at the repo root (`.oxlintrc.json`, `.oxfmtrc.json`).

`.githooks/pre-commit` blocks commits that fail `fmt:check`; `.githooks/commit-msg` strips Claude co-author / "Generated with Claude Code" lines. `just setup` enables both; on an existing clone run `git config core.hooksPath .githooks` once.

## Database (apps/api)

Postgres is on PlanetScale (via Cloudflare Hyperdrive at runtime) — no local Postgres process. The Prisma CLI uses the direct `DATABASE_URL` in `apps/api/.env`.

```bash
bun --cwd apps/api run db:push     # dev: push schema without migrations
bun --cwd apps/api run db:studio   # Prisma Studio GUI
bun --cwd apps/api run db:generate # regenerate Prisma client
```

Destructive/manual migrations live in `apps/api/scripts/migrations/` as dated
`.sql` files, applied with `prisma db execute --file`.

[apps/api/scripts/dump-search-schema.sql](../apps/api/scripts/dump-search-schema.sql)
dumps the full-text-search objects (the `searchVector` column, its GIN index, and
whichever mechanism populates it) that exist **only in the live database** — see
[docs/search.md](search.md).
Read-only; run it in PlanetScale's SQL console (needs no local `psql` or
`DATABASE_URL`). Use it to capture those definitions as a migration, and
afterwards to verify the migration still matches production.

## Cloudflare Workers usage

`bun run cf:usage` (`--daily` to split by day): CPU per Worker, the API
edge-cache hit rate, and API CPU per route. Rising `msPerReq` is a per-request
regression; flat `msPerReq` with rising `requests` is plain traffic growth. Auth,
gotchas and baselines are in [docs/usage-analytics.md](usage-analytics.md).

## Data pipeline

Sources (no npm dep): DE PublicExport JSON blobs (`data/raw/de/`) +
wiki Lua modules (`data/raw/wiki/`). The build merges them with the
curated overrides under `data/curated/`.

`data/raw/` is **gitignored** — it's a network mirror, not source. The built
catalog under `apps/web/public/data/` is what's committed and what ships, so a
plain clone runs the app fine. You only need the raw mirror to *rebuild* the
catalog.

One orchestrator does everything; the rest are primitives it chains:

```bash
bun run data:refresh               # do-it-all: data:sync + build:items + sync:images (weekly CI cron runs this)
bun run data:refresh --skip-sync   # rebuild from the on-disk mirror only (fast inner loop; skips re-pulling upstream)

# primitives (run individually when you need just one stage):
bun run data:sync                  # mirror DE PublicExport + wiki Lua into data/raw/
bun run build:items                # regenerate apps/web/public/data/ (emits UPSTREAM image URLs)
bun run sync:images                # mirror emitted images into R2, rewrite catalog → img.arsenyx.com

# guards (CI) + manual-edit helper:
bun run check:images               # fail if catalog still hotlinks content/wiki.warframe.com
bun run check:data-version         # fail if catalog changed but meta.json generatedAt didn't
bun run data:stamp                 # bump meta.json generatedAt — run after any HAND-edit to apps/web/public/data/
bun run data:ab [base-ref]          # ship only a pipeline change's catalog delta (see "Shipping a pipeline fix" below)
bun run data:patch <base> <fixed>  # the patch step data:ab runs, for hand-built snapshots
bun run data:diff [ref]            # markdown summary of catalog changes vs ref (default HEAD); the data cron's PR body
```

`build:items` alone leaves upstream CDN URLs in the catalog; `sync:images`
mirrors the bytes into R2 and rewrites them to `img.arsenyx.com`. Always pair
them (`data:refresh --skip-sync` does) — `check:images` blocks a hotlinked
catalog from merging. `sync:images` needs R2 creds in the root `.env` (see
`.env.example`); run via the build chain it self-skips when they're absent.

New items from a game update get no `releaseDate` from either source — append
them to [data/curated/release-history.json](../data/curated/release-history.json)
(date from the wiki's "Introduced" line) and rebuild, or they never reach the
landing page hero / "Recently added" ticker.

Hand-editing the catalog directly (a quick data fix without a full rebuild)?
Run `data:stamp` afterward — it's served `immutable` and cache-busted by
`?v=<generatedAt>`, so without a fresh `generatedAt` clients keep the stale
bytes. `data:refresh` and `build:items` stamp it for free; `check:data-version`
enforces it in CI.

`_report.json` lists every DE record the wiki join missed (`weaponsUnmatched`,
`framesUnmatched`, `companionsUnmatched`, `modsUnmatched`). An unmatched mod's
wiki flags (`isExilus`, `tradable`, Conclave) silently default to `false`, so a
new `modsUnmatched` entry in a refresh diff is a bug report waiting to happen.

### Shipping a pipeline fix without upstream drift

A full `build:items` from a fresh mirror also pulls in every unrelated upstream
change since the last refresh. To ship only what a pipeline fix changes, build
twice from the same mirror and patch the delta onto the committed catalog.
`data:patch` matches records by `uniqueName`, so it also catches derived files
you didn't know depended on the field (e.g. `mod-tradable.json` ← `tradable`):

```bash
# `bun run data:sync` first if data/raw/ is missing (or a module: scripts/sync-wiki.ts <Module/name>)
bun run data:ab            # base = HEAD in a throwaway worktree, fixed = working tree (committed or not); patches + stamps
bun run data:ab HEAD~1     # fix already committed: compare against the commit before it
bun --filter=arsenyx-web run test parsed-catalog --update  # then review the .snap.txt diff
```

`data:ab` ends with a **Changed fields** count per field path (`--verbose` lists
every change). Anything there besides your fix is drift: stop and investigate.
`data:patch <base> <fixed>` stays available for hand-built snapshots.

`apps/web/src/lib/stats/parsed-catalog.snap.txt` records how the stat engine reads every
mod and arcane, so a mod or arcane data change (or a `lib/stats/parser.ts` change) moves
it. Its diff is the list of items whose stats changed. Check each line before you accept it.

Both sync and build rewrite tracked files as a side effect: `data:sync` →
`data/PINS.json`, `build:items` → `data/curated/wiki-image-urls.json` (the
image-URL cache). Revert them unless the change is a full refresh (`data:ab`
restores the image cache itself). Patched
records keep the committed `img.arsenyx.com` URLs; a record the fix *adds*
carries an upstream URL, which `check:images` flags — run `sync:images` then.

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
