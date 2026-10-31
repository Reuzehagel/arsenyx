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
  - To discover field names: `POST .../telemetry/keys` with `{"timeframe":{...},"datasets":["cloudflare-workers"]}`.

## Baseline

Before #413's TTL bump (detail 120 s, lists 30 s), to compare against:

- Edge cache, 3 days: 5.5% hit, 73% stale (expired), 21% miss.
- API GET CPU, 24h ending 2026-10-25 11:00 UTC: `/builds/:slug` 54% at 56 ms/req, `/builds/:slug/partners` 29% at 45 ms, `/builds` 8% at 74 ms, `/users/*` 4%, `/auth/get-session` 2% at 12 ms. Total 2.45M CPU-ms over 50k requests.
