import { createFileRoute } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { EXTERNAL_LINKS } from "@/lib/util/constants"

export const Route = createFileRoute("/docs_/api")({
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
      "List public builds. Supports ?page, ?sort, ?q, ?category, ?hasGuide, ?hasShards.",
    example: `{
  "builds": [ { "slug": "...", "title": "...", "category": "warframe", ... } ],
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

          <h2 id="rate-limits">Rate limits</h2>
          <p>
            Requests are rate-limited per minute. Exceeding the limit returns{" "}
            <code>429</code> with body{" "}
            <code>{`{ "error": "rate_limited" }`}</code> and a{" "}
            <code>Retry-After</code> header.
          </p>
          <p>
            Traffic from the web app is bucketed by operation type, each bucket
            with its own per-user per-minute cap:
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
            Items, mods, and arcanes live as static JSON under{" "}
            <code>apps/web/public/data/</code>. The index is built from Digital
            Extremes&apos; PublicExport manifests and the{" "}
            <Link
              href={EXTERNAL_LINKS.wiki}
              target="_blank"
              rel="noopener noreferrer"
            >
              Warframe wiki
            </Link>
            , then committed to the repo, so loading game data is a single
            static fetch against the CDN — no API round-trip.
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
