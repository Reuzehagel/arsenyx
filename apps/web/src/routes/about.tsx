import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { SITE_CONFIG, EXTERNAL_LINKS } from "@/lib/constants"

export const Route = createFileRoute("/about")({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold tracking-tight">
              About {SITE_CONFIG.name}
            </h1>
            <p className="text-muted-foreground text-xl">
              {SITE_CONFIG.description}
            </p>
          </div>

          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <h2>How it started</h2>
            <p>
              Arsenyx exists because the other planners weren&apos;t open
              source and didn&apos;t look the way I wanted them to. It was
              built first with the Profit-Taker Community &mdash; they helped
              test it, shaped early decisions, and pushed it past being just a
              loadout tool. From there it grew into a whole platform.
            </p>

            <h2>Who&apos;s behind it</h2>
            <p>
              It&apos;s just me. No team, no company, no roadmap meetings
              &mdash; just one Tenno building the tool I wished existed, for
              the love of the game.
            </p>

            <h2>Open Source</h2>
            <p>
              Arsenyx is fully open source. Anyone can contribute code, suggest
              features, or report bugs.
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

            <h2>Shoutouts</h2>
            <p>
              Big thanks to{" "}
              <Link
                href="https://github.com/KalaayPT"
                target="_blank"
                rel="noopener noreferrer"
              >
                Kalaay
              </Link>{" "}
              for the help along the way &mdash; bouncing ideas around and
              opening PRs that made Arsenyx better.
            </p>

            <h2>Community Focused</h2>
            <p>
              From real-time stats updates to seamless sharing, every feature is
              designed to help the Warframe community. Data is automatically
              synced with Warframe Community Developers (WFCD) to ensure
              accuracy.
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
