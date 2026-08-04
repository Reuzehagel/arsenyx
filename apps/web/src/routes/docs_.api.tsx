import { createFileRoute } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { seo } from "@/lib/seo"
import { EXTERNAL_LINKS } from "@/lib/util/constants"

export const Route = createFileRoute("/docs_/api")({
  head: () =>
    seo({
      title: "API Reference",
      description:
        "Public API reference for Arsenyx — endpoints for builds, items, and embeds.",
      canonicalPath: "/docs/api",
    }),
  component: DocsApiPage,
})

type Endpoint = {
  method: "GET" | "POST" | "PUT"
  path: string
  summary: string
  example: string
}

const PUBLIC_ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/builds",
    summary:
      "List public builds. See the parameter table below for the full filter set.",
    example: `{
  "builds": [
    {
      "slug": "...",
      "name": "...",
      "item": {
        "uniqueName": "/Lotus/Powersuits/Ninja/Ninja",
        "name": "Ash",
        "category": "warframes",
        "imageName": "..."
      },
      "hasGuide": true,
      "hasShards": false,
      "user": { ... },
      "organization": null
    }
  ],
  "total": 1234,
  "page": 1,
  "limit": 24
}`,
  },
  {
    method: "GET",
    path: "/builds/:slug",
    summary: "Fetch a single public build by slug.",
    example: `{
  "slug": "...",
  "title": "...",
  "category": "warframe",
  "items": [...],
  "mods": [...],
  "arcanes": [...]
}`,
  },
  {
    method: "GET",
    path: "/orgs/public",
    summary:
      "Directory of all organizations. Paginated, with ?q for name/slug search.",
    example: `{
  "orgs": [
    { "slug": "...", "name": "...", "memberCount": 12, "buildCount": 34, ... }
  ],
  "total": 7,
  "page": 1,
  "limit": 20
}`,
  },
  {
    method: "GET",
    path: "/orgs/:slug",
    summary: "Organization profile: members, description, public build count.",
    example: `{
  "slug": "...",
  "name": "...",
  "members": [ { "role": "ADMIN" | "MEMBER", "user": {...} } ],
  "buildCount": 34
}`,
  },
  {
    method: "GET",
    path: "/orgs/:slug/builds",
    summary:
      "Public builds authored under an organization. Same filters as /builds.",
    example: `{
  "builds": [...],
  "total": 34,
  "page": 1,
  "limit": 24
}`,
  },
]

type QueryParam = {
  name: string
  values: string
  notes: string
}

// Keep in sync with parseListQuery in apps/api/src/routes/_build-list.ts.
const BUILD_LIST_PARAMS: QueryParam[] = [
  {
    name: "page",
    values: "1–500",
    notes:
      "Defaults to 1. Clamped at 500 — paging is offset-based, so deeper pages are refused rather than scanned.",
  },
  {
    name: "limit",
    values: "1–24",
    notes: "Defaults to 24, which is also the maximum.",
  },
  {
    name: "sort",
    values:
      "newest | updated | top | trending | bookmarked | viewed | forma-asc | forma-desc | name-asc | name-desc",
    notes: "Defaults to newest.",
  },
  {
    name: "q",
    values: "free text",
    notes:
      "Full-text search over build name, item name and description. Truncated at 200 characters.",
  },
  {
    name: "category",
    values:
      "warframes | primary | secondary | melee | necramechs | companions | companion-weapons | exalted-weapons | archwing | railjack",
    notes: "Matches the build's item category.",
  },
  {
    name: "item",
    values: "an item uniqueName",
    notes:
      "Exact match on the build's item. Takes the full uniqueName path, not a display name — see below.",
  },
  {
    name: "hasGuide",
    values: "true | false",
    notes:
      "Filters to builds that do (or explicitly do not) have a written guide. Omit for no filter. Also accepts 1/0, yes/no, on/off.",
  },
  {
    name: "hasShards",
    values: "true | false",
    notes: "Same three-state behaviour as hasGuide, for archon shards.",
  },
]

function EndpointCard({ ep }: { ep: Endpoint }) {
  return (
    <li className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs font-semibold">
          {ep.method}
        </span>
        <code className="text-sm font-medium">{ep.path}</code>
      </div>
      <p className="text-muted-foreground text-sm">{ep.summary}</p>
      <pre className="bg-muted/50 overflow-x-auto rounded p-3 text-xs leading-relaxed">
        <code>{ep.example}</code>
      </pre>
    </li>
  )
}

function DocsApiPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <div className="not-prose mb-6">
            <Button
              render={<Link href="/docs" />}
              nativeButton={false}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft data-icon="inline-start" />
              Back to documentation
            </Button>
          </div>
          <h1>API reference</h1>
          <p className="lead">
            HTTP endpoints for reading public data. For concepts (orgs,
            visibility), see the{" "}
            <Link href="/docs">documentation overview</Link>.
          </p>

          <h2 id="public-read-api">Public read API</h2>
          <p>
            Base URL: <code>{EXTERNAL_LINKS.apiBase}</code>. The endpoints below
            are public and read-only — no credentials required.
          </p>
          <ul className="not-prose flex list-none flex-col gap-4 pl-0">
            {PUBLIC_ENDPOINTS.map((ep) => (
              <EndpointCard key={`${ep.method} ${ep.path}`} ep={ep} />
            ))}
          </ul>
          <p className="text-sm opacity-75">
            Fields abbreviated. Responses are subject to change while Arsenyx is
            in beta — pin to the commit you tested against.
          </p>

          <h2 id="build-list-parameters">Build list parameters</h2>
          <p>
            These apply to <code>/builds</code>, <code>/orgs/:slug/builds</code>{" "}
            and <code>/users/:username/builds</code>. Unrecognized values are
            ignored rather than rejected — a filter you misspell comes back as
            an unfiltered list, not a <code>400</code>.
          </p>
          <div className="not-prose overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-border border-b text-left">
                  <th className="py-2 pr-4 font-semibold">Parameter</th>
                  <th className="py-2 pr-4 font-semibold">Values</th>
                  <th className="py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {BUILD_LIST_PARAMS.map((p) => (
                  <tr key={p.name} className="border-border/50 border-b">
                    <td className="py-2 pr-4 align-top">
                      <code className="text-foreground">{p.name}</code>
                    </td>
                    <td className="py-2 pr-4 align-top font-mono text-xs">
                      {p.values}
                    </td>
                    <td className="py-2 align-top">{p.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            To list every build for one item, pass its <code>uniqueName</code> —
            the same value that comes back in each row&apos;s{" "}
            <code>item.uniqueName</code>. The full set of them is in{" "}
            <code>items-index.json</code>, described under{" "}
            <Link href="#game-data">Game data</Link> below.
          </p>
          <pre className="bg-muted/50 overflow-x-auto rounded p-3 text-xs leading-relaxed">
            <code>
              {`${EXTERNAL_LINKS.apiBase}/builds?item=/Lotus/Powersuits/Ninja/Ninja&sort=top`}
            </code>
          </pre>

          <h2 id="rate-limits">Rate limits</h2>
          <p>
            Requests are rate-limited per minute. Exceeding the limit returns{" "}
            <code>429</code> with body{" "}
            <code>{`{ "error": "rate_limited" }`}</code> and a{" "}
            <code>Retry-After</code> header.
          </p>
          <p>
            <strong>If you are calling this API without credentials</strong> —
            which is the only way to use the public read endpoints — the limit
            that applies to you is{" "}
            <strong>120 requests per minute, per IP</strong>, across{" "}
            <code>/builds</code>, <code>/orgs</code>, <code>/users</code> and{" "}
            <code>/img</code>. Typeahead search is tighter at 30/min. Both are
            enforced at the Cloudflare edge, so a <code>429</code> costs you
            nothing but also tells you nothing about the backend.
          </p>
          <p>
            Staying well under that is easy: the static{" "}
            <Link href="#game-data">game data files</Link> are not rate-limited
            at all, so anything you can answer from{" "}
            <code>items-index.json</code> costs you no budget. Cache list
            responses on your side — they change slowly, and we already cache
            them at the edge for 10 seconds.
          </p>
          <p>
            Signed-in traffic from the web app is separately bucketed by
            operation type, each bucket with its own per-user per-minute cap:
          </p>
          <ul>
            <li>
              <strong>mutate</strong> — 20/min. Build create, update, delete,
              and fork.
            </li>
            <li>
              <strong>social</strong> — 60/min. Likes, bookmarks, and similar
              cheap toggles.
            </li>
            <li>
              <strong>import</strong> — 10/min. Overframe imports and other
              endpoints that fetch from external services.
            </li>
            <li>
              <strong>search</strong> — 60/min. Typeahead and full-text
              endpoints.
            </li>
          </ul>
          <p className="text-sm opacity-75">
            Limits are best-effort across Cloudflare Workers isolates: brief
            bursts can slip slightly over the cap before any isolate observes
            it. They&apos;re tuned for abuse throttling, not policing normal
            use.
          </p>

          <h2 id="game-data">Game data</h2>
          <p>
            Items, mods, and arcanes are static JSON served straight from the
            CDN at <code>https://www.arsenyx.com/data/</code> — no API
            round-trip, no rate limit, and nothing that touches our database.
            Prefer these over the API wherever they answer your question. The
            index is built from Digital Extremes&apos; PublicExport manifests
            and the{" "}
            <Link
              href={EXTERNAL_LINKS.wiki}
              target="_blank"
              rel="noopener noreferrer"
            >
              Warframe wiki
            </Link>
            , then committed to the repo.
          </p>
          <p>
            <code>items-index.json</code> is the item manifest. It&apos;s an
            object keyed by category, each holding an array of items — and each
            item&apos;s <code>uniqueName</code> is exactly what{" "}
            <code>/builds?item=</code> expects.
          </p>
          <pre className="bg-muted/50 overflow-x-auto rounded p-3 text-xs leading-relaxed">
            <code>{`{
  "warframes": [
    {
      "uniqueName": "/Lotus/Powersuits/Ninja/Ninja",
      "name": "Ash",
      "slug": "ash",
      "category": "warframes",
      "imageName": "https://img.arsenyx.com/Ash-<hash>.png",
      "masteryReq": 0,
      "isPrime": false,
      "displayClass": "Warframe",
      "releaseDate": "2012-10-25"
    }
  ],
  "primary": [ ... ]
}`}</code>
          </pre>
          <h3 id="data-versioning">Versioning these files</h3>
          <p>
            Everything under <code>/data/</code> is served{" "}
            <code>Cache-Control: immutable, max-age=1 year</code>, so a plain
            fetch will pin whatever you first downloaded for a very long time.
            Regenerated catalogs ship under a new <code>?v=</code> stamp rather
            than at the same URL. Read the current stamp from{" "}
            <code>/version.json</code> (always revalidated) and append it:
          </p>
          <pre className="bg-muted/50 overflow-x-auto rounded p-3 text-xs leading-relaxed">
            <code>{`const { dataVersion } = await fetch(
  "https://www.arsenyx.com/version.json",
).then((r) => r.json())

const items = await fetch(
  \`https://www.arsenyx.com/data/items-index.json?v=\${dataVersion}\`,
).then((r) => r.json())`}</code>
          </pre>
          <p className="text-sm opacity-75">
            <code>dataVersion</code> only changes when the catalog is
            regenerated (roughly once per game update), so it&apos;s cheap to
            cache your own copy and re-check occasionally. Don&apos;t use a
            random cache-buster — that forces a full origin fetch every time.
          </p>

          <h2>Source</h2>
          <p>
            Arsenyx is open source. Bug reports, feature requests, and pull
            requests are all welcome on GitHub.
          </p>
          <div className="not-prose">
            <Button
              render={
                <Link
                  href={EXTERNAL_LINKS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
            >
              <Icons.github data-icon="inline-start" />
              View on GitHub
            </Button>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
