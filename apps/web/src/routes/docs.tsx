import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { EXTERNAL_LINKS, SITE_CONFIG } from "@/lib/constants"

export const Route = createFileRoute("/docs")({
  component: DocsPage,
})

type Endpoint = {
  method: "GET" | "POST" | "PUT"
  path: string
  summary: string
  example: string
}

const WRITE_ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/v1/builds",
    summary:
      "Create a build. Body specifies item, slots, arcanes, shards, and optional guide. Server resolves canonical refs and recomputes derived fields.",
    example: `{
  "name": "Rhino Tank",
  "visibility": "PUBLIC",
  "itemUniqueName": "/Lotus/Powersuits/Rhino/Rhino",
  "itemCategory": "warframes",
  "guide": { "summary": "...", "description": "..." },
  "build": {
    "hasReactor": true,
    "slots": [
      {
        "slotId": "aura-0",
        "mod": {
          "uniqueName": "/Lotus/Upgrades/Mods/Aura/SteelCharge",
          "rank": 5
        }
      }
    ],
    "arcanes": [],
    "shards": [],
    "helminthAbility": null
  }
}`,
  },
  {
    method: "PUT",
    path: "/api/v1/builds/:slug",
    summary: "Update a build you own. Same payload shape as create.",
    example: `{ "name": "...", "build": { ... } }`,
  },
  {
    method: "POST",
    path: "/api/v1/imports/overframe",
    summary:
      "Import an Overframe build by URL. If nameOverride / description / guide are omitted, Arsenyx preserves the Overframe metadata. Explicit null clears nullable fields.",
    example: `{
  "url": "https://overframe.gg/build/935570/",
  "visibility": "PUBLIC",
  "nameOverride": null,
  "description": null,
  "guide": null
}`,
  },
]

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

function DocsPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Documentation</h1>
          <p className="lead">
            How {SITE_CONFIG.name} is put together, and how to build on top of
            it.
          </p>

          <h2>Overview</h2>
          <p>
            Arsenyx is a Warframe build planner. The app splits data in two:
            <strong> game data</strong> (items, mods, arcanes) is static JSON
            baked at build time and served from the CDN, while{" "}
            <strong>user data</strong> (builds, votes, bookmarks, organizations)
            lives in Postgres behind a small HTTP API. The site, the API, and
            the data pipeline are all open source.
          </p>

          <h2>Public API</h2>
          <p>
            Base URL: <code>{EXTERNAL_LINKS.apiBase}</code>. Authentication is cookie-based
            (Better Auth). The endpoints below are public and read-only — no
            credentials required. Write endpoints, user data, and admin routes
            require a session and aren&apos;t documented here.
          </p>
          <ul className="not-prose flex list-none flex-col gap-4 pl-0">
            {PUBLIC_ENDPOINTS.map((ep) => (
              <li
                key={`${ep.method} ${ep.path}`}
                className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4"
              >
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
            ))}
          </ul>
          <p className="text-sm opacity-75">
            Fields abbreviated. Responses are subject to change while Arsenyx
            is in beta — pin to the commit you tested against.
          </p>

          <h2>Authenticated write API</h2>
          <p>
            Arsenyx supports bearer-token build publishing, so you can push
            builds from a script or bot instead of clicking through the editor.
            Sign in, open the user menu, head to <strong>Settings</strong>, and
            create a personal access token with the <code>build:write</code>{" "}
            scope. Send it as <code>Authorization: Bearer &lt;token&gt;</code>.
          </p>
          <ul className="not-prose flex list-none flex-col gap-4 pl-0">
            {WRITE_ENDPOINTS.map((ep) => (
              <li
                key={`${ep.method} ${ep.path}`}
                className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4"
              >
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
            ))}
          </ul>
          <p className="text-sm opacity-75">
            The server resolves canonical item / mod / arcane / shard data,
            recomputes derived capacity and forma fields, and rejects invalid
            writes with structured <code>4xx</code> JSON errors.
          </p>

          <h2>Game data</h2>
          <p>
            Items, mods, and arcanes live as static JSON under{" "}
            <code>apps/web/public/data/</code>. The index is generated from the{" "}
            <Link
              href={EXTERNAL_LINKS.wfcd}
              target="_blank"
              rel="noopener noreferrer"
            >
              Warframe Community Developers
            </Link>{" "}
            dataset and committed to the repo, so loading game data is a single
            static fetch against the CDN — no API round-trip.
          </p>

          <h2>Contributing</h2>
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
