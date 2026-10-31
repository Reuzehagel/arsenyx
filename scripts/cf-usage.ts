/**
 * Cloudflare usage report: where the Workers CPU-ms go. `bun run cf:usage`
 * (`--daily` splits the per-Worker table by day). Background and gotchas live in
 * docs/usage-analytics.md.
 *
 * Three tables:
 *   1. CPU + requests per Worker, current billing cycle (GraphQL analytics)
 *   2. API edge-cache hit / expired / miss, last 3 days (zone GraphQL analytics)
 *   3. API CPU per route, last 24h (Workers Logs — needs CF_ANALYTICS_TOKEN)
 *
 * Auth: CF_ANALYTICS_TOKEN (read-only token), else wrangler's OAuth token, which
 * covers 1 and 2 only. The token is deliberately not CF_API_TOKEN /
 * CLOUDFLARE_API_TOKEN: wrangler reads those, and an analytics-only token there
 * breaks every wrangler command.
 */

import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const ACCOUNT = "18bb3173149fb0f522be36b26ed7027d"
const ZONE = "89b436282a7d8a3063c6f91aba820608" // arsenyx.com
const CYCLE_START_DAY = 8 // billing cycle runs from the 8th
const CPU_INCLUDED_MS = 30_000_000
const DAY_MS = 86_400_000

const daily = process.argv.includes("--daily")

const analyticsToken = process.env.CF_ANALYTICS_TOKEN?.trim().replace(
  /^["']|["']$/g,
  "",
)
const token = analyticsToken ?? wranglerToken()
if (!token) {
  console.error(
    "✗ cf:usage — set CF_ANALYTICS_TOKEN or run `bunx wrangler login`.",
  )
  process.exit(1)
}

function wranglerToken(): string | undefined {
  const base = process.env.APPDATA
    ? join(process.env.APPDATA, "xdg.config")
    : join(homedir(), ".config")
  const file = join(base, ".wrangler", "config", "default.toml")
  if (!existsSync(file)) return undefined
  // Expires hourly; `bunx wrangler whoami` refreshes it.
  return readFileSync(file, "utf8").match(/oauth_token = "([^"]+)"/)?.[1]
}

async function cf<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as {
    errors?: { message: string }[] | null
  } & T
  // GraphQL reports failures with HTTP 200 and an `errors` array.
  if (!res.ok || json.errors?.length) {
    throw new Error(`${path}: ${res.status} ${JSON.stringify(json.errors)}`)
  }
  return json
}

const gql = <T>(query: string) =>
  cf<{ data: T }>("graphql", { query }).then((r) => r.data)

const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z")
const fmt = (n: number) => Math.round(n).toLocaleString("en-US")
const pct = (part: number, whole: number) =>
  `${((100 * part) / whole).toFixed(1)}%`

const now = new Date()
const cycleStart = new Date(
  Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() - (now.getUTCDate() < CYCLE_START_DAY ? 1 : 0),
    CYCLE_START_DAY,
  ),
)

// 1. Per Worker, current cycle. cpuTimeUs is microseconds.
type WorkerRow = {
  sum: { requests: number; cpuTimeUs: number }
  dimensions: { scriptName: string; date?: string }
}
const workers = await gql<{
  viewer: { accounts: { workersInvocationsAdaptive: WorkerRow[] }[] }
}>(`{
  viewer { accounts(filter:{accountTag:"${ACCOUNT}"}) {
    workersInvocationsAdaptive(limit:10000, filter:{datetime_geq:"${iso(cycleStart)}", datetime_leq:"${iso(now)}"}) {
      sum { requests cpuTimeUs } dimensions { scriptName ${daily ? "date" : ""} }
    } } } }`)
const wRows = workers.viewer.accounts[0].workersInvocationsAdaptive
const totalCpu = wRows.reduce((s, r) => s + r.sum.cpuTimeUs / 1000, 0)
console.log(
  `\n1. Workers, billing cycle ${iso(cycleStart).slice(0, 10)} → today`,
)
console.table(
  wRows
    .sort(
      (a, b) =>
        (a.dimensions.date ?? "").localeCompare(b.dimensions.date ?? "") ||
        b.sum.cpuTimeUs - a.sum.cpuTimeUs,
    )
    .map((r) => ({
      worker: r.dimensions.scriptName,
      ...(daily && { date: r.dimensions.date }),
      requests: fmt(r.sum.requests),
      cpuMs: fmt(r.sum.cpuTimeUs / 1000),
      msPerReq: (r.sum.cpuTimeUs / 1000 / Math.max(r.sum.requests, 1)).toFixed(
        1,
      ),
    })),
)
console.log(
  `Total CPU ${fmt(totalCpu)} ms of ${fmt(CPU_INCLUDED_MS)} included (analytics are sampled; Billing is the source of truth)`,
)

// 2. API edge cache, last 3 days. Cache API lookups show up as GETs with
// requestSource edgeWorkerCacheAPI; `stale` = an entry existed but had expired.
type CacheRow = { count: number; dimensions: { cacheStatus: string } }
const cache = await gql<{
  viewer: { zones: { httpRequestsAdaptiveGroups: CacheRow[] }[] }
}>(`{
  viewer { zones(filter:{zoneTag:"${ZONE}"}) {
    httpRequestsAdaptiveGroups(limit:20, filter:{datetime_geq:"${iso(new Date(now.getTime() - 3 * DAY_MS))}", datetime_leq:"${iso(now)}",
      clientRequestHTTPHost:"api.arsenyx.com", requestSource:"edgeWorkerCacheAPI", clientRequestHTTPMethodName:"GET"}) {
      count dimensions { cacheStatus }
    } } } }`)
const cRows = cache.viewer.zones[0].httpRequestsAdaptiveGroups
const lookups = cRows.reduce((s, r) => s + r.count, 0)
console.log("\n2. API edge-cache lookups, last 3 days")
console.table(
  cRows.map((r) => ({
    status: r.dimensions.cacheStatus,
    lookups: fmt(r.count),
    share: pct(r.count, lookups),
  })),
)

// 3. API CPU per route, last 24h. Path filters, not groupBys: grouping by path
// explodes per slug and caps at 1000 groups. The path key is $workers.event.path;
// $workers.event.request.path silently matches nothing.
if (!analyticsToken) {
  console.log(
    "\n3. Per-route CPU skipped: needs CF_ANALYTICS_TOKEN (Workers Observability read).",
  )
  process.exit(0)
}

const ROUTES: [label: string, operation: string, value: string][] = [
  ["GET /builds/:slug", "regex", "^/builds/[^/]+$"],
  ["GET /builds/:slug/partners", "includes", "/partners"],
  ["GET /builds", "eq", "/builds"],
  ["GET /users/*", "starts_with", "/users/"],
  ["GET /orgs/*", "starts_with", "/orgs/"],
  ["GET /auth/get-session", "eq", "/auth/get-session"],
  ["GET /img*", "starts_with", "/img"],
]

type Calc = { result: { calculations: { aggregates: { value: number }[] }[] } }
async function routeCpu(pathFilter?: { operation: string; value: string }) {
  const filters = [
    {
      key: "$workers.scriptName",
      operation: "eq",
      type: "string",
      value: "arsenyx-api",
    },
    {
      key: "$workers.event.request.method",
      operation: "eq",
      type: "string",
      value: "GET",
    },
    ...(pathFilter
      ? [{ key: "$workers.event.path", type: "string", ...pathFilter }]
      : []),
  ]
  const r = await cf<Calc>(
    `accounts/${ACCOUNT}/workers/observability/telemetry/query`,
    {
      queryId: "adhoc",
      timeframe: { from: now.getTime() - DAY_MS, to: now.getTime() },
      view: "calculations",
      parameters: {
        datasets: ["cloudflare-workers"],
        filterCombination: "and",
        filters,
        calculations: [
          { operator: "sum", key: "$workers.cpuTimeMs", keyType: "number" },
          { operator: "count" },
        ],
        groupBys: [],
      },
    },
  )
  const [cpu, count] = r.result.calculations.map(
    (c) => c.aggregates[0]?.value ?? 0,
  )
  return { cpu, count }
}

const allGet = await routeCpu()
const routes = await Promise.all(
  ROUTES.map(async ([label, operation, value]) => ({
    label,
    ...(await routeCpu({ operation, value })),
  })),
)
console.log("\n3. API GET CPU per route, last 24h")
console.table(
  routes
    .sort((a, b) => b.cpu - a.cpu)
    .map((r) => ({
      route: r.label,
      cpuMs: fmt(r.cpu),
      share: pct(r.cpu, allGet.cpu),
      requests: fmt(r.count),
      msPerReq: (r.cpu / Math.max(r.count, 1)).toFixed(1),
    })),
)
console.log(
  `All API GETs: ${fmt(allGet.cpu)} ms CPU over ${fmt(allGet.count)} requests`,
)
