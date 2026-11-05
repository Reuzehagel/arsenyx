# Cloudflare usage analytics

Where the Workers' CPU time goes, and why. Run:

```bash
bun run cf:usage          # add --daily to split the per-Worker table by day
```

[scripts/cf-usage.ts](../scripts/cf-usage.ts) prints three tables: CPU and requests per Worker for the current billing cycle, the API edge-cache hit / expired / miss split, and API CPU per route. Extend the script rather than hand-writing queries here.

## Billing facts

- The Workers Paid allowance that gets exceeded is **30M CPU-ms per month**, not requests. Requests (10M included) sit far below that. Overage is cents per million CPU-ms.
- The billing cycle starts on the **8th**. The script windows table 1 to the cycle.
- **The Billing page is the source of truth for cost** (Manage account → Billing → Billable usage). The three sources disagree: GraphQL analytics are sampled, and Workers Logs count differently. Use them only for comparisons (before vs after, route vs route).
- Almost all CPU is `arsenyx-api`. A request that misses the edge cache builds a fresh PrismaClient (~50 ms CPU); a hit costs almost nothing. Edge-cache TTLs (`DETAIL_TTL` / `LIST_TTL` in [apps/api/src/routes/builds.ts](../apps/api/src/routes/builds.ts)) are the main lever.

## Auth

`CF_ANALYTICS_TOKEN` (Windows user env var) holds the read-only Cloudflare token `arsenyx-analytics-readonly`: Account Analytics, Workers Observability, and arsenyx.com zone Analytics, all read. Without it, the script falls back to wrangler's OAuth token (run `bunx wrangler whoami` to refresh it), which can't read Workers Logs, so the per-route table is skipped. The name is deliberately not `CF_API_TOKEN` / `CLOUDFLARE_API_TOKEN`: wrangler reads those, and an analytics-only token there breaks every wrangler command.

## Gotchas

- In zone analytics, `PUT` / `PURGE` rows on `api.arsenyx.com` are the Worker's own Cache API writes and evictions (`requestSource: edgeWorkerCacheAPI`), not user edits. Real client traffic is `requestSource: eyeball`.
- `workersInvocationsAdaptive` has a real `sum { cpuTimeUs }` (microseconds). There's no need to estimate CPU from P50 × requests.
- Workers Logs (`POST /accounts/<id>/workers/observability/telemetry/query`) fails silently. A wrong key returns `success: true` with empty aggregates.
  - The path key is `$workers.event.path`, not `$workers.event.request.path`.
  - The group limit goes in `parameters.limit`. A top-level `limit` is ignored, and the default is 10 groups. Groups cap at 1000, and grouping by path explodes per slug, so filter by path (`eq`, `includes`, `starts_with`, `regex`) instead.
  - Percentile operators are `median`, `p90`, `p99`, …; there is no `p50` (rejected with a ZodError).
  - To discover field names: `POST .../telemetry/keys` with `{"timeframe":{...},"datasets":["cloudflare-workers"]}`.

## Baseline

Before #413's TTL bump (detail 120 s, lists 30 s), to compare against:

- Edge cache, 3 days: 5.5% hit, 73% stale (expired), 21% miss.
- API GET CPU, 24h ending 2026-10-25 11:00 UTC: `/builds/:slug` 54% at 56 ms/req, `/builds/:slug/partners` 29% at 45 ms, `/builds` 8% at 74 ms, `/users/*` 4%, `/auth/get-session` 2% at 12 ms. Total 2.45M CPU-ms over 50k requests.

After #451 (prod, 2026-11-04 21:30 → 11-05 08:00 UTC): `/builds/:slug` median 9 ms, but the 17% of requests ≥ 60 ms (mean 158 ms) were 79% of its CPU. `?embed=1` averaged 127 ms, so nearly every unfurl missed the KV snapshot. A Prisma-path request costs ~140 ms in prod against ~25–30 ms in the local profile, likely cold isolates at our low per-colo traffic (unconfirmed). Response: `SNAPSHOT_TTL` 10 min → 24 h. The detail route logs `detail:kv-miss` and `detail:live` (signed-in) per request; count them in Workers Logs (filter on the log message) to size what's left before converting those paths to plain SQL.

## Profiling

`bun run cf:profile` CPU-profiles the local API ([scripts/cf-profile.ts](../scripts/cf-profile.ts); usage in its header). Production capture (`cf workers versions profile`) isn't the route: at our traffic it attaches to an idle isolate and returns an empty profile.

Profile of a cache-missing build read (2026-11-04, wrangler 4.157): about half the CPU is per-request setup, not route logic. All DB queries together are ~2.3 ms of ~29 ms. The SCRAM password hash (PBKDF2) was ~13% until [scram-cache.ts](../apps/api/src/lib/scram-cache.ts) cached it per isolate; constructing the per-request `PrismaClient` is now the biggest single item (~16%: it decodes Prisma's parameterization graph and starts an empty query-plan cache). Sharing one client per isolate removes that but is **unsafe**: Prisma's DataLoader batches `findUnique` calls across concurrent requests, so one request's query runs on another's connection and hangs (reproduced 2026-11-04). The pure per-schema parts of that construction (the wasm `QueryCompiler`, which re-parses the schema in wasm on every connect, the plan cache and the parameterization graph) are instead shared per isolate by a bun patch on `@prisma/client` (see [commands.md](commands.md#database-appsapi)): local detail misses ~30 → ~25.5 ms, list and `/users/:username` ~22 → ~17.5 ms, wasm time ~3.4 → ~0 ms. The lever is still fewer misses per page view, not faster queries.

KV build snapshots (2026-11-04, same session and wrangler, 300 cookieless anonymous detail misses x 3 runs, interleaved): baseline 30.2–32.2 ms busy CPU per request, snapshot path 9.9–11.1 ms. Of that, ~3–4 ms is the bare pg connection that counts the view (no `vw_` cookie); with the cookie set it drops to 7.3–8.5 ms (baseline with the cookie: 23.5–24.3 ms), the rest being local platform simulation (rate limiter, Cache API, routing). Counting views through Prisma instead of bare pg: 13.4–13.8 ms. A cold read-through (KV miss, load + put): 26.4–27.5 ms. Wall time per anonymous miss: 41.7 → 11.4–11.8 ms mean (local KV is on disk; prod KV hot reads add a few ms).

Profiling gotchas: `--var NODE_ENV:production` no longer overrides `apps/api/.env` on wrangler 4.157, so set `NODE_ENV="production"` in `.env` for the session (dev query logging skews the profile). Runs compare only within one wrangler version: the Nov 2026 workerd made Prisma client construction ~12% costlier than the Apr 2026 one on identical code.
