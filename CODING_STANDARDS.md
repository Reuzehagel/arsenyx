# Coding standards

Applied at review. Mechanical rules live in oxlint / `just check`, not here.

## Worker module scope holds settled data only

In `apps/api/src` and `apps/web/worker`, a module-level variable may cache a resolved value (parsed JSON, a lookup map). Promises, DB clients, streams, and anything else still tied to I/O live per request: Workers ties I/O to the request that started it, so another request awaiting it can hang or throw `Cannot perform I/O on behalf of a different request`. Flag a module-level `let`/`const` holding a pending promise or client, even one with a comment arguing for sharing it. Pattern: `imageMapCache` in [apps/web/worker/index.ts](apps/web/worker/index.ts); request-scoped Prisma in [apps/api/src/db.ts](apps/api/src/db.ts).

## Caches fail open and write only values

A cache read on a request path (KV, the edge cache) is an optimisation over Postgres: when it throws, the request falls back to the database, never a 500. The read path writes to the cache only when it has a value to store; a write or delete per miss or 404 is billed (KV) and multiplied by anyone probing slugs. Invalidation on mutation is where deletes belong. Pattern: the anonymous branch of `GET /builds/:slug` in [apps/api/src/routes/builds.ts](apps/api/src/routes/builds.ts).

## Writes refresh every build snapshot they change

The anonymous build snapshot lives 24 h in KV and embeds the build, its author, its org, and its partner strip. A mutation that changes any of those (or deletes them, including by cascade) calls `invalidateBuilds` after the write; for a user or org change, it collects the slugs with `snapshotSlugs(where)` *before* the write, since a cascade removes the rows. Flag a new write to builds, users, organizations or partner links that skips this: the old content stays public for a day. The helpers that do both halves (`deleteBuild`, `deleteOrganization`) live in [apps/api/src/routes/_build-snapshot.ts](apps/api/src/routes/_build-snapshot.ts); a new path should use one.

## Edge and client head tags are identical

The Worker ([apps/web/worker/index.ts](apps/web/worker/index.ts)) and each route's `head` emit the same value per tag: a JS-rendering crawler sees both, and Google drops `rel=canonical` outright when it sees two. Values come from one shared builder ([packages/shared/src/seo/](packages/shared/src/seo/), `PAGE_META`, `buildPageSeo`); flag a title, description, canonical or noindex computed separately in either layer. The one intended difference: on PUBLIC build pages the Worker appends live like/view stats to `og:description` only. Canonical, og:url and og:image go out for PUBLIC builds only, from both layers.

## Each web data concern goes through its owner

In `apps/web`, an API call goes through `apiCall` and maps errors with its `codes` / `serverMessage` / `notFoundOn404` options; a query key comes from its resource's key factory; a stored build becomes `SavedBuildData` through `loadBuildData`; browser storage goes through `lib/util/storage.ts`. Flag a hand-built `fetch` to the API, a literal query key, a cast of raw `buildData`, or a direct `localStorage` call: each bypasses the one place that handles errors, cache invalidation, legacy formats or private-mode failures.

## Shared loadout rendering takes values, not editor state

`components/build-loadout/` renders for both the viewer and the editor. The viewer passes plain values (derived with `loadoutFromSaved` / `extrasFromSaved`); the editor adds an optional `edit` object of handlers. Flag a no-op callback or a `readOnly` flag passed to make a component work in the viewer, or an editor hook run only to read data.

## Game rules come from the catalog

A Warframe rule (which mods conflict, fit a slot, stack, trade; ability or item behaviour) is read from `apps/web/public/data/` ([index](docs/commands.md#what-the-built-catalog-holds)) or cites a wiki page. Flag a hand-written list or regex of mod/item names that encodes such a rule: it drifts with every game update. Example: `mod-conflicts.json`, never a `/^(Primed|Umbral…)/` name filter.
