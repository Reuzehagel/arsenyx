# Coding standards

Applied at review. Mechanical rules live in oxlint / `just check`, not here.

## Worker module scope holds settled data only

In `apps/api/src` and `apps/web/worker`, a module-level variable may cache a resolved value (parsed JSON, a lookup map). Promises, DB clients, streams, and anything else still tied to I/O live per request: Workers ties I/O to the request that started it, so another request awaiting it can hang or throw `Cannot perform I/O on behalf of a different request`. Flag a module-level `let`/`const` holding a pending promise or client, even one with a comment arguing for sharing it. Pattern: `imageMapCache` in [apps/web/worker/index.ts](apps/web/worker/index.ts); request-scoped Prisma in [apps/api/src/db.ts](apps/api/src/db.ts).

## Game rules come from the catalog

A Warframe rule (which mods conflict, fit a slot, stack, trade; ability or item behaviour) is read from `apps/web/public/data/` ([index](docs/commands.md#what-the-built-catalog-holds)) or cites a wiki page. Flag a hand-written list or regex of mod/item names that encodes such a rule: it drifts with every game update. Example: `mod-conflicts.json`, never a `/^(Primed|Umbral…)/` name filter.
