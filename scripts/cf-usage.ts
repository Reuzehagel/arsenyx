/**
 * Cloudflare usage report: where the Workers CPU-ms go. `bun run cf:usage`
 * (`--daily` splits the per-Worker table by day). Background and gotchas live in
 * docs/usage-analytics.md.
 *
 * Three tables:
 *   1. CPU + requests per Worker, current billing cycle (GraphQL analytics)
 *   2. API edge-cache hit / expired / miss, last 3 days (zone GraphQL analytics)
 *   3. API CPU per route, last 24h or `--since <iso>` (e.g. a deploy time), with
 *      median, p90 and the CPU share of >= 60 ms requests; plus counts of the
 *      detail:kv-miss / detail:live log lines (Workers Logs — needs
 *      CF_ANALYTICS_TOKEN)
 *
 * `--rum [host]` prints Web Analytics (referrers, countries, devices, paths)
 * for the last 30 days instead; `--rum-perf [host]` prints P75 page-load
 * timings (7 days) by device, country and path.
 *
 * Auth: CF_ANALYTICS_TOKEN (read-only token), else wrangler's OAuth token, which
 * covers 1 and 2 only. The token is deliberately not CF_API_TOKEN /
 * CLOUDFLARE_API_TOKEN: wrangler reads those, and an analytics-only token there
 * breaks every wrangler command.
 */

import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { DETAIL_MARKERS } from "../apps/api/src/lib/measure"

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

// `--rum-perf [host]`: Web Analytics page-load timings (P75, ms) for the last 7
// days, overall and split by device, country and path. "rest" is page load
// minus request, response and connect: mostly parsing, running JS and loading
// subresources before the load event. Counts are adaptively sampled (round
// thousands = few real loads), so one slow visit can swing a row's P75.
const perfAt = process.argv.indexOf("--rum-perf")
if (perfAt !== -1) {
  const arg = process.argv[perfAt + 1]
  const host = arg && !arg.startsWith("--") ? arg : "www.arsenyx.com"
  const since = iso(new Date(Date.now() - 7 * DAY_MS))
  const dims = ["", "deviceType", "countryName", "requestPath"]
  const group = (dim: string) =>
    `${dim || "all"}: rumPerformanceEventsAdaptiveGroups(limit:12, orderBy:[count_DESC],
      filter:{requestHost:"${host}", datetime_geq:"${since}"}) {
      count quantiles { pageLoadTimeP75 requestTimeP75 responseTimeP75
        connectionTimeP75 firstContentfulPaintP75 }
      ${dim ? `dimensions { ${dim} }` : ""} }`
  type PerfRow = {
    count: number
    quantiles: Record<string, number>
    dimensions?: Record<string, string>
  }
  const perf = await gql<{
    viewer: { accounts: Record<string, PerfRow[]>[] }
  }>(`{ viewer { accounts(filter:{accountTag:"${ACCOUNT}"}) {
    ${dims.map(group).join("\n")} } } }`)
  const acc = perf.viewer.accounts[0]!
  // Quantiles are microseconds.
  const ms = (us: number) => fmt(us / 1000).padStart(7)
  console.log(`Web Analytics P75 timings (ms), ${host}, since ${since}`)
  for (const d of dims) {
    const key = d || "all"
    console.log(
      `\n${key.padEnd(28)}  count     load    req   resp   conn   rest    FCP`,
    )
    for (const r of acc[key]!) {
      const q = r.quantiles
      const rest =
        q.pageLoadTimeP75! -
        q.requestTimeP75! -
        q.responseTimeP75! -
        q.connectionTimeP75!
      const label = d ? r.dimensions?.[d] || "(none)" : "all"
      console.log(
        `${label.slice(0, 28).padEnd(28)}  ${fmt(r.count).padStart(5)}${ms(q.pageLoadTimeP75!)}${ms(q.requestTimeP75!)}${ms(q.responseTimeP75!)}${ms(q.connectionTimeP75!)}${ms(rest)}${ms(q.firstContentfulPaintP75!)}`,
      )
    }
  }
  process.exit(0)
}

// `--rum [host]`: Web Analytics (visitor) report for the last 30 days instead of
// the CPU tables. Any host that loads our beacon token shows up here (forks too).
const rumAt = process.argv.indexOf("--rum")
if (rumAt !== -1) {
  const arg = process.argv[rumAt + 1]
  const host = arg && !arg.startsWith("--") ? arg : "www.arsenyx.com"
  const since = iso(new Date(Date.now() - 30 * DAY_MS))
  const group = (dim: string, limit: number) =>
    `${dim}: rumPageloadEventsAdaptiveGroups(limit:${limit}, orderBy:[count_DESC],
      filter:{requestHost:"${host}", datetime_geq:"${since}"}) {
      count sum { visits } dimensions { ${dim} } }`
  type RumRow = {
    count: number
    sum: { visits: number }
    dimensions: Record<string, string>
  }
  const dims = ["refererHost", "countryName", "deviceType", "requestPath"]
  const rum = await gql<{
    viewer: { accounts: Record<string, RumRow[]>[] }
  }>(`{ viewer { accounts(filter:{accountTag:"${ACCOUNT}"}) {
    ${dims.map((d) => group(d, 15)).join("\n")} } } }`)
  const acc = rum.viewer.accounts[0]!
  console.log(`Web Analytics, ${host}, since ${since}`)
  for (const d of dims) {
    console.log(`\n${d.padEnd(30)}  page views  visits`)
    for (const r of acc[d]!)
      console.log(
        `${(r.dimensions[d] || "(none)").slice(0, 30).padEnd(30)}  ${fmt(r.count).padStart(10)}  ${fmt(r.sum.visits).padStart(6)}`,
      )
  }
  process.exit(0)
}

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

// 3. API CPU per route since --since (default: last 24h). Path filters, not
// groupBys: grouping by path explodes per slug and caps at 1000 groups. The
// path key is $workers.event.path; $workers.event.request.path silently
// matches nothing. "heavy" = the share of a route's CPU from requests >= 60 ms:
// the mean hides a bimodal route (cheap cache/KV hits vs. Prisma-path misses).
if (!analyticsToken) {
  console.log(
    "\n3. Per-route CPU skipped: needs CF_ANALYTICS_TOKEN (Workers Observability read).",
  )
  process.exit(0)
}

const sinceArg = process.argv[process.argv.indexOf("--since") + 1]
const since = process.argv.includes("--since")
  ? Date.parse(sinceArg)
  : now.getTime() - DAY_MS
if (Number.isNaN(since)) {
  console.error(`✗ cf:usage — --since needs an ISO time, got "${sinceArg}"`)
  process.exit(1)
}

type Filter = { key: string; operation: string; value?: string | number }
const f = (key: string, operation: string, value?: string | number) => ({
  key,
  operation,
  value,
})
const path = (operation: string, value: string) =>
  f("$workers.event.path", operation, value)
const DETAIL = path("regex", "^/builds/[^/]+$")
const ROUTES: [label: string, ...filters: Filter[]][] = [
  ["GET /builds/:slug", DETAIL],
  [
    "  ?embed=1",
    DETAIL,
    f("$workers.event.request.url", "includes", "embed=1"),
  ],
  ["  ?view=0", DETAIL, f("$workers.event.request.url", "includes", "view=0")],
  ["GET /builds/:slug/partners", path("includes", "/partners")],
  ["GET /builds", path("eq", "/builds")],
  ["GET /users/*", path("starts_with", "/users/")],
  ["GET /orgs/*", path("starts_with", "/orgs/")],
  ["GET /auth/get-session", path("eq", "/auth/get-session")],
  ["GET /img*", path("starts_with", "/img")],
]
const GET = f("$workers.event.request.method", "eq", "GET")
const HEAVY = f("$workers.cpuTimeMs", "gte", 60)

type Calc = { result: { calculations: { aggregates: { value: number }[] }[] } }
async function query(filters: Filter[], withCpu = true) {
  const cpuKey = { key: "$workers.cpuTimeMs", keyType: "number" }
  const r = await cf<Calc>(
    `accounts/${ACCOUNT}/workers/observability/telemetry/query`,
    {
      queryId: "adhoc",
      timeframe: { from: since, to: now.getTime() },
      view: "calculations",
      parameters: {
        datasets: ["cloudflare-workers"],
        filterCombination: "and",
        filters: [
          f("$workers.scriptName", "eq", "arsenyx-api"),
          ...filters,
        ].map((x) => ({
          type: typeof x.value === "number" ? "number" : "string",
          ...x,
        })),
        calculations: [
          { operator: "count" },
          ...(withCpu
            ? ["sum", "median", "p90"].map((operator) => ({
                operator,
                ...cpuKey,
              }))
            : []),
        ],
        groupBys: [],
      },
    },
  )
  const [count, cpu = 0, median = 0, p90 = 0] = r.result.calculations.map(
    (c) => c.aggregates[0]?.value ?? 0,
  )
  return { count, cpu, median, p90 }
}

const allGet = await query([GET])
const routes = await Promise.all(
  ROUTES.map(async ([label, ...filters]) => {
    const [all, heavy] = await Promise.all([
      query([GET, ...filters]),
      query([GET, ...filters, HEAVY]),
    ])
    return { label, ...all, heavyCpu: heavy.cpu }
  }),
)
console.log(`\n3. API GET CPU per route since ${iso(new Date(since))}`)
console.table(
  routes.map((r) => ({
    route: r.label,
    cpuMs: fmt(r.cpu),
    share: pct(r.cpu, allGet.cpu),
    requests: fmt(r.count),
    msPerReq: (r.cpu / Math.max(r.count, 1)).toFixed(1),
    median: r.median,
    p90: r.p90,
    heavy: pct(r.heavyCpu, Math.max(r.cpu, 1)),
  })),
)
console.log(
  `All API GETs: ${fmt(allGet.cpu)} ms CPU over ${fmt(allGet.count)} requests`,
)

// Build-detail requests that took a Prisma path (builds.ts logs one line
// each): an anonymous KV miss, or a signed-in viewer. Console lines are their
// own events, matched on $metadata.message.
const detailPaths = await Promise.all(
  Object.values(DETAIL_MARKERS).map(async (m) => ({
    log: m,
    requests: fmt(
      (await query([f("$metadata.message", "eq", m)], false)).count,
    ),
  })),
)
console.table(detailPaths)
