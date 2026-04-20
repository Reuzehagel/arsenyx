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
      <main className="container max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold tracking-tight">
              About {SITE_CONFIG.name}
            </h1>
            <p className="text-muted-foreground text-xl">
              {SITE_CONFIG.description}
            </p>
          </div>

          <div className="prose prose-neutral dark:prose-invert flex max-w-none flex-col gap-8">
            <section>
              <h2 className="mb-4 text-2xl font-semibold">Our Mission</h2>
              <p>
                Arsenyx was built with one goal in mind: to be the fastest, most
                modern Warframe build planner. We believe that planning your
                loadout should be as fluid and fast as the game itself. Focused
                on keyboard-first navigation and immediate feedback, we&apos;re
                rethinking how Tennos share and optimize their builds.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">Open Source</h2>
              <p>
                We believe in the power of community. That&apos;s why Arsenyx is
                fully open source. Anyone can contribute code, suggest features,
                or report bugs. We&apos;re building this together.
              </p>
              <div className="mt-6 flex gap-4">
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
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">Community Focused</h2>
              <p>
                From real-time stats updates to seamless sharing, every feature
                is designed to help the Warframe community. Data is
                automatically synced with Warframe Community Developers (WFCD)
                to ensure accuracy.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
