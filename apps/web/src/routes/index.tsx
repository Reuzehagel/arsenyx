import { createFileRoute } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import {
  formatDate,
  isPrimeRedundant,
  useRecentItems,
} from "@/components/landing/use-recent-items"
import { Link } from "@/components/link"
import { Kbd } from "@/components/ui/kbd"
import { itemsIndexQuery } from "@/lib/items-index-query"
import { getImageUrl, getItemUrl } from "@/lib/warframe"

export const Route = createFileRoute("/")({
  // Pre-warm the items index so the hero/ticker render on first paint
  // instead of flashing in once useRecentItems resolves.
  loader: ({ context }) => context.queryClient.ensureQueryData(itemsIndexQuery),
  component: Home,
})

function Home() {
  const recent = useRecentItems(10)
  const hero =
    recent.find((it) => it.category === "warframes" && it.isPrime) ?? recent[0]

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero — single object, breathing */}
        <section className="relative overflow-hidden border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-y-12 px-6 pt-20 pb-24 md:grid-cols-12 md:gap-x-10 md:pt-28 md:pb-32">
            {/* Left: object */}
            <div className="relative md:col-span-5">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(closest-side,oklch(0.9_0_0_/_0.6),transparent_70%)] dark:bg-[radial-gradient(closest-side,oklch(0.3_0_0_/_0.5),transparent_70%)]"
              />
              {hero ? (
                <Link
                  href={getItemUrl(hero.category, hero.slug)}
                  className="mx-auto flex w-fit flex-col items-stretch"
                >
                  <img
                    src={getImageUrl(hero.imageName)}
                    alt={hero.name}
                    className="h-[220px] w-auto object-contain transition-transform duration-700 ease-out hover:scale-[1.02] md:h-[280px]"
                    draggable={false}
                  />
                  <div className="text-muted-foreground mt-5 flex items-baseline justify-between gap-3 text-[11px] tracking-[0.22em] uppercase">
                    <span className="font-mono">
                      {formatDate(hero.releaseDate)}
                    </span>
                    <span className="text-foreground">{hero.name}</span>
                  </div>
                </Link>
              ) : (
                <div className="bg-muted/40 mx-auto h-[280px] w-full max-w-sm animate-pulse rounded-lg" />
              )}
            </div>

            {/* Right: statement + ticker */}
            <div className="md:col-span-7">
              <h1 className="text-3xl leading-[1.05] font-semibold tracking-[-0.01em] text-balance md:text-5xl">
                A build planner
                <br />
                for Warframe.
              </h1>
              <p className="text-muted-foreground mt-6 max-w-md text-base leading-relaxed">
                Every frame, weapon, and companion in the game. Mods, arcanes,
                shards. A URL when you're done.
              </p>

              <div className="mt-10 flex items-center gap-4">
                <Link
                  href="/browse"
                  className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-85"
                >
                  Open arsenal
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  or press <Kbd>?</Kbd> for shortcuts
                </span>
              </div>

              {/* ticker */}
              <div className="mt-14 border-t pt-6">
                <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
                  Recently added
                </p>
                <ul className="mt-3 space-y-1.5">
                  {recent.slice(1, 6).map((it) => (
                    <li
                      key={`${it.category}-${it.slug}`}
                      className="flex items-baseline gap-3 text-sm"
                    >
                      <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                        {formatDate(it.releaseDate)}
                      </span>
                      <Link
                        href={getItemUrl(it.category, it.slug)}
                        className="text-foreground truncate hover:underline"
                      >
                        {it.name}
                      </Link>
                      {it.isPrime && !isPrimeRedundant(it.name) && (
                        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
                          prime
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Three pillars — shown, not described */}
        <section className="border-b">
          <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-14 px-6 py-20 md:grid-cols-3 md:py-28">
            <Pillar
              kicker="Keyboard"
              line="Press ? for shortcuts."
              detail="The command palette searches frames, weapons, mods, arcanes, and builds. Arrows move between slots in the editor. The full list is one keystroke away."
              demo={
                <div className="bg-background flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs">
                  <Kbd>Ctrl K</Kbd>
                  <span className="text-foreground">command palette</span>
                  <span className="text-muted-foreground ml-auto inline-flex items-center gap-1">
                    <Kbd>?</Kbd>
                  </span>
                </div>
              }
            />
            <Pillar
              kicker="Sharing"
              line="One URL, no account."
              detail="Builds encode into a short URL. Drop it in chat. The reader sees the full editor without signing in."
              demo={
                <div className="bg-background rounded-md border px-3 py-2 font-mono text-xs">
                  <span className="text-muted-foreground">arsenyx.com/b/</span>
                  <span className="text-foreground">v0r-prime-tank</span>
                </div>
              }
            />
            <Pillar
              kicker="Open"
              line="MIT, on GitHub."
              detail="No ads, no telemetry, no email-gated previews. Patches and forks welcome."
              demo={
                <Link
                  href="https://github.com/Reuzehagel/arsenyx"
                  className="bg-background hover:bg-muted/60 inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs"
                >
                  <span className="text-muted-foreground">git clone</span>
                  <span className="text-foreground">arsenyx</span>
                  <span className="text-muted-foreground ml-auto" aria-hidden>
                    ↗
                  </span>
                </Link>
              }
            />
          </div>
        </section>

        {/* Quiet closing */}
        <section>
          <div className="mx-auto max-w-7xl px-6 py-16 text-center">
            <p className="text-muted-foreground font-mono text-xs tracking-[0.22em] uppercase">
              Begin
            </p>
            <Link
              href="/browse"
              className="group text-foreground mt-4 inline-flex items-baseline gap-3 text-2xl font-medium tracking-tight hover:underline md:text-3xl"
            >
              Open the arsenal
              <ArrowRight
                aria-hidden
                className="size-5 self-center transition-transform duration-300 group-hover:translate-x-1 md:size-6"
              />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function Pillar({
  kicker,
  line,
  detail,
  demo,
}: {
  kicker: string
  line: string
  detail: string
  demo: React.ReactNode
}) {
  return (
    <article className="flex flex-col gap-4">
      <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
        {kicker}
      </p>
      <h3 className="text-foreground text-2xl font-medium tracking-tight">
        {line}
      </h3>
      <div>{demo}</div>
      <p className="text-muted-foreground text-sm leading-relaxed">{detail}</p>
    </article>
  )
}
