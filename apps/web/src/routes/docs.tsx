import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { seo } from "@/lib/seo"
import { EXTERNAL_LINKS, SITE_CONFIG } from "@/lib/util/constants"

export const Route = createFileRoute("/docs")({
  head: () =>
    seo({
      title: "Docs",
      description:
        "Documentation for Arsenyx — embedding builds, the public API, and integrating with the Warframe build planner.",
      canonicalPath: "/docs",
    }),
  component: DocsPage,
})

// Anchors that used to live on /docs (API reference page) and have since moved
// to /docs/api. Inbound bookmarks/social-card links to these hashes get
// forwarded so they still land on the right section.
const MOVED_HASHES: Record<string, string> = {
  "#public-api": "#public-read-api",
  "#public-read-api": "#public-read-api",
  "#game-data": "#game-data",
}

function DocsPage() {
  const navigate = useNavigate()
  useEffect(() => {
    const hash = window.location.hash
    const target = MOVED_HASHES[hash]
    if (target) {
      void navigate({ to: "/docs/api", hash: target.slice(1), replace: true })
    }
  }, [navigate])

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Documentation</h1>
          <p className="lead">
            How {SITE_CONFIG.name} is put together — the concepts behind builds,
            organizations, sharing, and the public API.
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
          <p>
            Building on top of Arsenyx programmatically? Jump straight to the{" "}
            <Link href="/docs/api">API reference</Link>.
          </p>

          <h2>Builds</h2>
          <p>
            A build is an item (warframe, weapon, companion, etc.) plus its
            slots — mods, arcanes, shards — and an optional written guide. When
            you save one, the server resolves the canonical references and
            recomputes derived fields like remaining capacity and forma count,
            so the same build looks the same to every viewer.
          </p>
          <h3>Visibility</h3>
          <ul>
            <li>
              <strong>Public</strong> builds appear in the{" "}
              <Link href="/browse">browse</Link> and{" "}
              <Link href="/builds">builds</Link> directories, are searchable,
              and anyone can vote or bookmark them.
            </li>
            <li>
              <strong>Private</strong> builds are link-only. They don&apos;t
              appear in any listing — only the owner can edit, but anyone with
              the URL can view.
            </li>
          </ul>
          <p>
            Build slugs are short, stable, and URL-safe (no ambiguous{" "}
            <code>0/O/1/l/I</code> characters). They never change after
            creation, so a shared link keeps working even after edits.
          </p>
          <h3>Importing from Overframe</h3>
          <p>
            Existing Overframe builds can be pulled in from the{" "}
            <Link href="/import">import page</Link> by URL. Arsenyx preserves
            the original name, description, and guide unless you override them
            at import time.
          </p>

          <h2>Organizations</h2>
          <p>
            An organization is a named group with its own profile at{" "}
            <code>/org/&lt;slug&gt;</code>, listing members and the public
            builds attributed to it. Useful for clans, content creators, and
            communities that want a shared home for their builds without giving
            up individual authorship.
          </p>
          <h3>Roles</h3>
          <ul>
            <li>
              <strong>Admin</strong> — manages members, edits org settings, and
              publishes builds under the org. Every org has at least one admin.
            </li>
            <li>
              <strong>Member</strong> — publishes builds under the org, but
              can&apos;t change membership or settings.
            </li>
          </ul>
          <p>
            Membership is invite-only: an existing admin adds you from the org
            settings page. Builds you publish stay tied to your user account —
            attributing them to an org doesn&apos;t transfer ownership, it adds
            a second badge.
          </p>
          <h3>Discovery</h3>
          <p>
            The public directory at <Link href="/orgs">/orgs</Link> lists every
            organization with its member and build counts. Org profiles and
            their public builds are accessible without an account.
          </p>

          <h2>Profiles, votes, and bookmarks</h2>
          <p>
            Every signed-in user has a public profile at{" "}
            <code>/profile/&lt;username&gt;</code> showing their public builds.
            Votes signal which builds the community finds useful and feed into
            sort order on the browse listings. Bookmarks are private — only you
            see your own list, at <Link href="/bookmarks">/bookmarks</Link>.
          </p>

          <h2>Open source</h2>
          <p>
            Arsenyx is MIT-licensed. The web app, API, and data-extraction
            scripts all live in one monorepo on GitHub. Bug reports, feature
            requests, and pull requests are welcome — no telemetry, no
            email-gated previews.
          </p>
          <div className="not-prose flex flex-wrap gap-3">
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
            <Button
              render={<Link href="/docs/api" />}
              nativeButton={false}
              variant="outline"
            >
              API reference
            </Button>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
