import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Link } from "@/components/link"
import { seo } from "@/lib/seo"
import { EXTERNAL_LINKS, SITE_CONFIG } from "@/lib/util/constants"

export const Route = createFileRoute("/privacy")({
  head: () => seo({ title: "Privacy Policy", canonicalPath: "/privacy" }),
  component: PrivacyPage,
})

const LAST_UPDATED = "2026-06-12"

function PrivacyPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold tracking-tight">Privacy</h1>
          <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>

          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <p>
              {SITE_CONFIG.name} is a free, open-source Warframe build planner
              run by one person in the Netherlands. No company, no ads, and no
              tracking beyond a cookieless page-view counter. This page tells
              you what data the site has on you and what you can do about it.
            </p>

            <h2>What we store</h2>
            <p>
              You can browse the site without an account. If you sign in with
              GitHub, we store:
            </p>
            <ul>
              <li>
                Your GitHub profile fields (user ID, username, display name,
                avatar URL, and the email address attached to your GitHub
                account). We never see your GitHub password.
              </li>
              <li>
                A session record so you stay signed in. It includes the IP
                address and user-agent string of the device that signed in.
                Sessions expire 7 days after their last use — each visit rolls
                that expiry forward, so a continuously active session can last
                indefinitely until you sign out or revoke it from settings.
              </li>
              <li>
                The OAuth access and refresh tokens that GitHub issues to us, so
                we can keep your session refreshed. They live in the database
                row associated with your account and are not exposed via any
                API.
              </li>
              <li>
                Whatever you create: builds, guides, votes, bookmarks, and
                organizations.
              </li>
            </ul>
            <p>
              Cloudflare (hosting) and PlanetScale (database, hosted in
              Frankfurt) may also keep short-lived request logs containing IP
              addresses for the purpose of detecting abuse and diagnosing
              outages.
            </p>

            <h2>Analytics</h2>
            <p>
              We use Cloudflare Web Analytics to count page views. It is
              cookieless: it sets no cookies, stores nothing on your device, and
              does not fingerprint you via your IP address or user agent. We
              only see aggregate numbers — page views, referrers, countries, and
              page-load times — never anything tied to an individual visitor.
            </p>

            <h2>What we don&apos;t do</h2>
            <p>
              We don&apos;t use advertising trackers, fingerprinting, or
              A/B-testing. We don&apos;t sell or share your data with anyone for
              marketing. The only cookies the site sets are the ones Better Auth
              needs to keep you signed in: a session token and a short-lived
              session-cache cookie. No tracking cookies, no third-party cookies.
            </p>

            <h2>Deleting your account</h2>
            <p>
              You can delete your account at any time from the settings dialog.
              That permanently removes your account, all sessions, your API
              keys, your votes, bookmarks and organization memberships, and
              every build and guide you authored. Shared links to your builds
              will return 404 afterwards. You can also export all your builds as
              JSON from the same panel before deleting.
            </p>
            <p>
              Residual copies in routine database backups age out within 30
              days.
            </p>

            <h2>Your rights</h2>
            <p>
              Under the GDPR you can ask to see what data we hold on you,
              correct it, delete it, or have it exported. You can do all of this
              yourself from the settings dialog: edit your profile, export every
              build as JSON, or delete your account outright. For anything you
              can&apos;t resolve from settings, open an issue on the{" "}
              <Link
                href={EXTERNAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub repository
              </Link>{" "}
              — if the request contains personal data you&apos;d rather not post
              publicly, mark the issue title accordingly and the operator will
              reply with a private channel. If you think we&apos;ve mishandled
              your data and we can&apos;t resolve it together, you can complain
              to the data protection authority in your country.
            </p>

            <h2>Open source</h2>
            <p>
              The code is on{" "}
              <Link
                href={EXTERNAL_LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </Link>{" "}
              — if you want to see exactly what&apos;s stored and how, the
              schema and API code are right there.
            </p>

            <h2>Changes</h2>
            <p>
              If this policy changes materially, the &ldquo;Last updated&rdquo;
              date above will move and the commit will be visible in the public
              repo.
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
