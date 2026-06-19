import { createFileRoute } from "@tanstack/react-router"
import { Heart } from "lucide-react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { seo } from "@/lib/seo"
import { SITE_CONFIG, EXTERNAL_LINKS } from "@/lib/util/constants"

export const Route = createFileRoute("/about")({
  head: () =>
    seo({
      title: "About",
      description:
        "What Arsenyx is, who builds it, and why it's open source. A fast, community-driven Warframe build planner.",
      canonicalPath: "/about",
    }),
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
              Arsenyx exists because the other planners weren&apos;t open source
              and didn&apos;t look the way I wanted them to. It was built first
              with the Profit-Taker Community &mdash; they helped test it,
              shaped early decisions, and pushed it past being just a loadout
              tool. From there it grew into a whole platform.
            </p>

            <h2>Who&apos;s behind it</h2>
            <p>
              It&apos;s just me. No team, no company, no roadmap meetings
              &mdash; just one Tenno building the tool I wished existed, for the
              love of the game. Arsenyx is free and ad-free, and the hosting
              runs me about $10 a month out of pocket. If it&apos;s useful to
              you, a tip genuinely helps keep it online.
            </p>
            <div className="not-prose">
              <Button
                render={
                  <Link
                    href={EXTERNAL_LINKS.koFi}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
              >
                <Heart data-icon="inline-start" />
                Support on Ko-fi
              </Button>
            </div>

            <h2>Open source</h2>
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

            <h2>Shout-outs</h2>
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

            <h2>Where the data comes from</h2>
            <p>
              Items, mods, and arcanes come straight from Digital Extremes&apos;
              public game data, with the Warframe wiki filling the gaps. When
              the game updates, the data does too.
            </p>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
