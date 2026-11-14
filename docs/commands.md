# Commands

## Dev

```bash
just dev                # web + api together (default)
just web                # Vite SPA only (http://localhost:5173)
just api                # Hono API only (http://localhost:8787)
just stop               # kill dev servers on :5173 / :5174 / :8787
just setup              # first-run wizard — see CONTRIBUTING.md
```

### Ports taken by another worktree

When another checkout already holds :5173 / :8787, a second pair lands on other
ports, but the web app still calls `http://localhost:8787` (the other checkout's
API and database), and the API's CORS list rejects the new web port. Wire the
pair together by hand:

1. Read the API's real port from its log line `Ready on http://127.0.0.1:<port>`.
   Wrangler picks its own free port, so the port a preview tool reports can be wrong.
2. `apps/web/.env.local`: `VITE_API_URL=http://localhost:<api port>`, then restart the web server.
3. Start the API with the web origin passed in, rather than editing `.env`:
   `bun run dev --port <api port> --var WEB_ORIGIN:http://localhost:<web port>`.

An explicit `--port` (or `--inspector-port`, default 9229) that another
checkout already holds does not fail on Windows: both `workerd`s bind and
requests split between them, so you see the other checkout's DB errors. Pick
ports nobody holds — check with `netstat -ano | grep LISTEN`.

## Build / verify

```bash
just check                        # THE gate before claiming done — gen + typecheck + oxlint + oxfmt --check + check:native-button + check:layering + tests
just fix                          # oxlint --fix + oxfmt --write
just test                         # = `bun run test` (CI runs the same): vitest across apps/web, apps/api, packages/shared + bun test scripts/
just gen                          # generate apps/web/src/routeTree.gen.ts only (no-op if present)
bun --cwd apps/web run build      # Vite production build (does NOT typecheck — `just check` is the gate)
```

Reading a PR's code: the generated catalog (`apps/web/public/data/`, `data/curated/wiki-image-urls.json`) can make `gh pr diff` hundreds of KB. Check out the branch and diff without it; read the data side separately when the PR is a data fix:

```bash
git diff <merge-base> HEAD -- . ':!apps/web/public/data' ':!data/curated/wiki-image-urls.json'
```

Oxlint / oxfmt config lives at the repo root (`.oxlintrc.json`, `.oxfmtrc.json`).

`.githooks/pre-commit` blocks commits that fail `fmt:check`; `.githooks/commit-msg` strips Claude co-author / "Generated with Claude Code" lines; `post-merge` / `post-checkout` run `just deps` when `bun.lock` changed, so `bun run` scripts after a pull don't hit missing packages. `bun install` enables them (the root `prepare` script sets `core.hooksPath`), as does `just setup`.

## Database (apps/api)

Prod is PlanetScale (via Cloudflare Hyperdrive at runtime). Dev is a local
Postgres container ([compose.yaml](../compose.yaml), `localhost:54320`) shared by
every checkout, with **one database per checkout/worktree** (`arsenyx_<folder>`),
so parallel worktrees never collide. `just setup` points `apps/api/.env` at it
(both `DATABASE_URL` and the Hyperdrive local string), pushes the schema, applies
the search migration, and seeds an admin plus generated sample data
([seed-sample.ts](../apps/api/scripts/seed-sample.ts): users, an org, ~70 builds
of real catalog items with likes/guides). No prod or Neon data is copied.

```bash
just db-reset                      # drop + rebuild this checkout's DB (same sample data each time)
docker compose down                # stop the container (data persists in the volume)
bun --cwd apps/api run db:push     # dev: push schema without migrations
bun --cwd apps/api run db:studio   # Prisma Studio GUI
bun --cwd apps/api run db:generate # regenerate Prisma client
```

### A build went missing

Claude can't connect to prod (the permission classifier blocks the prod URL), so it writes the SQL and the owner runs it in the PlanetScale console on `main`.

1. Get the build link or slug from whoever reported it. A 404 from `api.arsenyx.com/builds/<slug>` means deleted *or* not visible to you, so it settles nothing.
2. `SELECT b.slug, b.visibility, b."organizationId", u.username FROM builds b JOIN users u ON u.id = b."userId" WHERE b.slug = '<slug>';` A row means it exists and is just private, or belongs to someone else.
3. `SELECT "deletedById", "deletedAt", build->>'name', build->>'userId' FROM build_deletions WHERE slug = '<slug>';` gives who deleted it and when. To undo, with `<id>` the tombstone's `id`:
   ```sql
   -- Links to a fork source or org deleted since are dropped (and hideAuthor with the org), or the FK aborts the insert.
   INSERT INTO builds SELECT * FROM jsonb_populate_record(NULL::builds, (
     SELECT build
       || CASE WHEN EXISTS (SELECT 1 FROM builds WHERE id = build->>'forkedFromId') THEN '{}' ELSE '{"forkedFromId": null}' END::jsonb
       || CASE WHEN EXISTS (SELECT 1 FROM organizations WHERE id = build->>'organizationId') THEN '{}' ELSE '{"organizationId": null, "hideAuthor": false}' END::jsonb
     FROM build_deletions WHERE id = '<id>'));
   INSERT INTO build_guides SELECT * FROM jsonb_populate_record(NULL::build_guides, (SELECT build->'buildGuide' FROM build_deletions WHERE id = '<id>' AND jsonb_typeof(build->'buildGuide') = 'object'));
   INSERT INTO "_PartnerBuilds" ("A", "B")
     SELECT x.a, x.b FROM build_deletions d
     CROSS JOIN LATERAL jsonb_array_elements(d.build->'partnerBuilds') p
     CROSS JOIN LATERAL (VALUES (d."buildId", p->>'id'), (p->>'id', d."buildId")) x(a, b)
     WHERE d.id = '<id>' AND EXISTS (SELECT 1 FROM builds WHERE id = p->>'id')
     ON CONFLICT DO NOTHING;
   UPDATE builds SET "likeCount" = 0, "dislikeCount" = 0, "bookmarkCount" = 0 WHERE id = (SELECT "buildId" FROM build_deletions WHERE id = '<id>');
   ```
   Extra JSON keys are ignored and the search trigger rebuilds `searchVector`. Not restored: likes, bookmarks (hence the zeroed counts), edit history (`build_revisions`), view days, and forks' `forkedFromId` (nulled on delete). Tombstones are kept 90 days. Account deletion leaves none, on purpose.
4. Only for deletes older than that, or from before tombstones existed: restore a backup (Backups → a backup → Restore, which creates a new branch billed while it exists; daily backups are kept 2 days), run step 2 on it, then delete the branch.

### Sign in as the dev admin

`just setup` seeds `admin@local.dev` and keeps its password in `apps/api/.env`
(`SEED_ADMIN_PASSWORD`, gitignored, local DB only). An older checkout without it:
run `just setup` once.

- **Browser** (you or an agent in the browser pane): open `/auth/signin` and
  click **Sign in**. The dev form is prefilled from
  `apps/web/.env.development.local`, which setup writes and Vite loads only
  under `vite dev`.
- **API / curl**: `curl -H "$(just dev-login)" http://localhost:8787/auth/get-session`.
  For a second worktree's API port: `API_URL=http://localhost:8788 just dev-login`.

**Upgrading Prisma:** `@prisma/client` carries a bun patch
([patches/](../patches/), `patchedDependencies` in the root `package.json`) that
shares the query compiler, plan cache and parameterization graph across the
per-request clients. The patch is keyed to the exact version, so after a bump
[prisma-patch.test.ts](../apps/api/src/prisma-patch.test.ts) fails: run
`bun patch @prisma/client`, re-apply the old patch's edits to
`runtime/wasm-compiler-edge.mjs` in the printed folder (old patch shows them),
then `bun patch --commit <folder>` and delete the old patch file.

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
wiki Lua modules (`data/raw/wiki/`, the list is `WIKI_MODULES` in
[scripts/build/read-wiki.ts](../scripts/build/read-wiki.ts)). The build merges them with the
curated overrides under `data/curated/` — per-item game facts the sources get
wrong or lack (aliases, mod-pool overrides, twin-frames, subsumable abilities,
beast-claw routing, dropped mods, …) are data there, not code in `scripts/build/`.
Every pipeline path, including `CATALOG_OUT_DIR` (redirects the catalog that
`build:items`, `sync:images`, `check:images`, `data:stamp` and `data:patch`
read and write), is in [scripts/build/paths.ts](../scripts/build/paths.ts).

Incarnon trees are hand-curated; the weekly data-refresh PR never adds one. A new Incarnon
weapon goes into `INCARNON_NAMES` in
[incarnon-data.ts](../packages/shared/src/warframe/incarnon-data.ts) (a genesis weapon also into
`INCARNON_GENESIS_IMAGES`; innate ones have no adapter image) and gets its tree in
[incarnon-evolutions.ts](../packages/shared/src/warframe/incarnon-evolutions.ts), with
per-variant values under `variants` where the wiki lists a column per variant. A new genesis
adapter icon needs `data:sync` first, so the texture is in the DE manifest, then `sync:images`.

### What the built catalog holds

Game rules (compatibility, conflicts, tradability) come from these files, not memory:

| File (`apps/web/public/data/`) | Holds |
| --- | --- |
| `items-index.json` | every item by category: uniqueName, slug, displayClass, image |
| `items/<category>/<slug>.json` | one item's full stats, slots, polarities |
| `mods-all.json` | every mod: polarity, drain, ranks, `compatName`, `type`, augment/exilus flags, level stats |
| `mod-conflicts.json` | uniqueName → mods that can't share a build with it (Primed/Umbral/Archon variants etc.) |
| `mod-tradable.json` | uniqueNames of NON-tradable mods (absent = tradable) |
| `arcanes-all.json` | every arcane: type, rarity, level stats |
| `helminth-abilities.json` | abilities subsumable via Helminth |
| `incarnon-evolutions.json` | Incarnon tiers and perks per weapon |
| `modular.json` | kitgun/zaw part stats |
| `*-images.json`, `image-map.json` | uniqueName/part → R2 image URL |
| `meta.json` | `generatedAt` (cache-bust version), counts |
| `_report.json` | build-pipeline report (unmatched entries, unknown companion types, rank-up drift) |

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
bun run check:wrangler             # wrangler dry-run of both Workers; fails on config warnings (needs apps/web dist/) — run after editing a wrangler.toml
bun run data:stamp                 # bump meta.json generatedAt + recount records — run after any HAND-edit to apps/web/public/data/
bun run data:ab [base-ref]          # ship only a pipeline change's catalog delta; --check verifies a no-op refactor (see "Shipping a pipeline fix" below)
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

**A refactor that must not change the catalog:** `bun run data:ab HEAD --check` builds both sides the same way, exits 1 listing every differing file (meta.json's `generatedAt` ignored), and touches neither the live catalog nor the image cache. From a worktree without `data/raw/`, add `--raw <main-checkout>/data/raw`.

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
Re-running `data:ab` after editing the fix refreshes the records it added
(back to upstream URLs, so `sync:images` again).

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
