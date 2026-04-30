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
    recent.find((it) => it.category === "warframes" && it.isPrime) ??
    recent[0]

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
                  <div className="mt-5 flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    <span className="font-mono">
                      {formatDate(hero.releaseDate)}
                    </span>
                    <span className="text-foreground">{hero.name}</span>
                  </div>
                </Link>
              ) : (
                <div className="mx-auto h-[280px] w-full max-w-sm animate-pulse rounded-lg bg-muted/40" />
              )}
            </div>

            {/* Right: statement + ticker */}
            <div className="md:col-span-7">
              <h1 className="text-3xl leading-[1.05] font-semibold tracking-[-0.01em] text-balance md:text-5xl">
                A build planner
                <br />
                for Warframe.
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Every frame, weapon, and companion in the game.
                Mods, arcanes, shards. A URL when you're done.
              </p>

              <div className="mt-10 flex items-center gap-4">
                <Link
                  href="/browse"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
                >
                  Open arsenal
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  or press <Kbd>/</Kbd> to search
                </span>
              </div>

              {/* ticker */}
              <div className="mt-14 border-t pt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Recently added
                </p>
                <ul className="mt-3 space-y-1.5">
                  {recent.slice(1, 6).map((it) => (
                    <li
                      key={`${it.category}-${it.slug}`}
                      className="flex items-baseline gap-3 text-sm"
                    >
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatDate(it.releaseDate)}
                      </span>
                      <Link
                        href={getItemUrl(it.category, it.slug)}
                        className="truncate text-foreground hover:underline"
                      >
                        {it.name}
                      </Link>
                      {it.isPrime && !isPrimeRedundant(it.name) && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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
              line="Press / to find anything."
              detail="The command palette searches frames, weapons, mods, arcanes, and builds. Arrow keys do the rest."
              demo={
                <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 font-mono text-xs">
                  <span className="text-muted-foreground">/</span>
                  <span className="text-foreground">voruna</span>
                  <span className="ml-auto inline-block h-3 w-1.5 animate-pulse bg-foreground" />
                </div>
              }
            />
            <Pillar
              kicker="Sharing"
              line="One URL, no account."
              detail="Builds encode into a short URL. Drop it in chat. The reader sees the full editor without signing in."
              demo={
                <div className="rounded-md border bg-background px-3 py-2 font-mono text-xs">
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
                  className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 font-mono text-xs hover:bg-muted/60"
                >
                  <span className="text-muted-foreground">git clone</span>
                  <span className="text-foreground">arsenyx</span>
                  <span className="ml-auto text-muted-foreground" aria-hidden>
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
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Begin
            </p>
            <Link
              href="/browse"
              className="group mt-4 inline-flex items-baseline gap-3 text-2xl font-medium tracking-tight text-foreground hover:underline md:text-3xl"
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
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {kicker}
      </p>
      <h3 className="text-2xl font-medium tracking-tight text-foreground">
        {line}
      </h3>
      <div>{demo}</div>
      <p className="text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </article>
  )
}
