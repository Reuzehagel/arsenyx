# Reviewing and merging PRs

Merge blockers to check on every PR, beyond what CI catches. A reviewer subagent gets this file, not a hand-written checklist.

## Before reviewing

- `git worktree list` for the PR's `headRefName`. A local worktree may be ahead of the PR head; review that and report unpushed commits (`git log --oneline <pr-head>..HEAD`).

## Blockers

- **Data cache bust** — a hand-edit under `apps/web/public/data/` bumps `meta.json` `generatedAt`. The `?v=` stamp comes only from it ([vite.config.ts](../apps/web/vite.config.ts) `dataVersion()`), and `/data/*` is `immutable`, so without the bump browsers keep the old bytes.
- **Schema before merge** — any Prisma schema change, even an additive column, ships an idempotent SQL file in `apps/api/scripts/migrations/` and is applied to prod before merge: push to `main` deploys the API, and Prisma selects the new column at once. CI fails such a PR until it carries the `schema-applied` label; add the label only after the SQL has run on prod, and remove it again if a later commit changes the schema.
- **Bindings before merge** — a new KV / R2 / Hyperdrive binding in `apps/*/wrangler.toml` must already exist in Cloudflare (`bunx wrangler kv namespace list`, etc.) with a matching id.
- **Saved builds still decode** — a codec change in `packages/shared/` reads every older build format.
- **Game rules sourced** — a hardcoded slot, compatibility, or mechanic rule is backed by the wiki or a data file (see the game-mechanic rule in [CLAUDE.md](../CLAUDE.md)); report what couldn't be verified.
- **Changelog** — a change under `apps/web/src/` or `apps/web/worker/` has a player-facing entry in `apps/web/src/data/changelog.ts`, or the `no-changelog` label when players can't see it.
- **Visibility** — new read paths (caches, raw SQL, snapshots) serve PRIVATE builds only to their owner, and every write path that changes what anon readers see invalidates them.

## Merging a batch

GitHub auto-merge is disabled and `main` is unprotected, so CI on each PR ran against the `main` it branched from.

1. Merge one: `gh pr merge N --squash --delete-branch`.
2. Before the next, wait for its `mergeStateStatus` to be `CLEAN` (`gh pr view N --json mergeStateStatus`).
3. After the last: fast-forward local `main`, run `just check`, then `just prune-worktrees` (dry run; `--go` once the user confirms). On Windows `--delete-branch` leaves the worktree folder and local branch behind.
