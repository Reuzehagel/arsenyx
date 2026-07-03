import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
import { seo } from "@/lib/seo"
import { EXTERNAL_LINKS, SITE_CONFIG } from "@/lib/util/constants"

export const Route = createFileRoute("/terms")({
  head: () => seo({ title: "Terms of Service", canonicalPath: "/terms" }),
  component: TermsPage,
})

const LAST_UPDATED = "2026-06-28"

function TermsPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold tracking-tight">Terms</h1>
          <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>

          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <p>
              {SITE_CONFIG.name} is a free, open-source Warframe build planner
              run by one person in the Netherlands. By using the site, you agree
              to the following — if you don&apos;t, please don&apos;t use it.
            </p>

            <h2>Use of the service</h2>
            <p>
              Browse all you want without an account. Signing in (via GitHub)
              lets you create builds, vote, bookmark, and join organizations.
              Don&apos;t use the service to do anything illegal, to post content
              that infringes other people&apos;s rights or is
              harassing/hateful/sexually explicit, or to abuse the API beyond
              the rate limits documented at{" "}
              <Link href="/docs/api#rate-limits">/docs/api#rate-limits</Link>.
              We may remove content or suspend accounts that break those rules,
              and we may also remove builds or other content at our discretion —
              for example spam, test, duplicate, or broken builds — to keep the
              site useful.
            </p>

            <h2>Your content</h2>
            <p>
              Builds and guides you create are yours. When you publish a build
              publicly, you give {SITE_CONFIG.name} permission to host and
              display it, and you allow other users to view and fork it. That
              permission ends when you make the build private or delete it
              (apart from short-lived copies in database backups, which age out
              within 30 days).
            </p>

            <h2>Warframe</h2>
            <p>
              {SITE_CONFIG.name} is not affiliated with Digital Extremes Ltd.{" "}
              <i>Warframe</i> and everything in it — names, marks, art, game
              data — belongs to Digital Extremes or its licensors. Game data
              comes from Digital Extremes&apos; public exports and the Warframe
              community wiki, and is used consistent with the{" "}
              <Link
                href="https://www.warframe.com/eula"
                target="_blank"
                rel="noopener noreferrer"
              >
                Warframe EULA
              </Link>
              .
            </p>

            <h2>Open source</h2>
            <p>
              The source code is on{" "}
              <Link
                href={EXTERNAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </Link>{" "}
              under the MIT licence. That covers the code only — not user
              content and not Warframe assets.
            </p>

            <h2>No warranties</h2>
            <p>
              The service is provided as-is. It might break, lose data, or
              disappear; we&apos;ll do our best to avoid that, but we can&apos;t
              promise it. Nothing here limits rights you have under mandatory
              consumer-protection law in your country of residence within the
              EU/EEA.
            </p>

            <h2>Ending things</h2>
            <p>
              You can delete your account from settings at any time — see the{" "}
              <Link href="/privacy">Privacy</Link> page for what that does. If
              the service is ever shut down, we&apos;ll give at least 30
              days&apos; notice on the site so you can export your builds first.
            </p>

            <h2>Governing law</h2>
            <p>
              Dutch law applies, without prejudice to mandatory consumer rules
              in your own EU/EEA country.
            </p>

            <h2>Changes</h2>
            <p>
              If these terms change, the &ldquo;Last updated&rdquo; date above
              will move. The full history is visible in the public repo.
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
