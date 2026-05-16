import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

interface ChangelogEntry {
  date: string
  version?: string
  changes: {
    type: "feat" | "fix" | "refactor" | "chore"
    description: string
  }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-09",
    changes: [
      {
        type: "fix",
        description:
          "Arch-gun arcane slots are now correctly typed as Primary and Secondary so the right arcanes are offered.",
      },
      {
        type: "feat",
        description:
          "Hovering a build's timestamp shows when it was last updated.",
      },
    ],
  },
  {
    date: "2026-05-08",
    changes: [
      {
        type: "feat",
        description:
          "Item detail pages have been redesigned, and browse lists and loading skeletons got an overhaul to feel snappier.",
      },
      {
        type: "feat",
        description:
          "Item, category, and author in the build header are now clickable links.",
      },
      {
        type: "refactor",
        description:
          "Author links stay neutral gray; purple is now reserved for organizations.",
      },
      {
        type: "fix",
        description:
          "Builds list no longer flashes empty on navigation — the prefetched data is reused correctly now.",
      },
    ],
  },
  {
    date: "2026-05-05",
    changes: [
      {
        type: "chore",
        description:
          "Game data updated to Warframe 42.0.9 (wfcd/items 1.1274.12).",
      },
    ],
  },
  {
    date: "2026-05-04",
    changes: [
      {
        type: "feat",
        description:
          "Damage types and currency now use in-game icons instead of generic badges.",
      },
      {
        type: "fix",
        description:
          "Zaw images load again — refreshed to the latest canonical names.",
      },
      {
        type: "fix",
        description:
          "Zaw selector no longer flickers along the right edge on hover.",
      },
    ],
  },
  {
    date: "2026-05-03",
    changes: [
      {
        type: "feat",
        description:
          "Arch-guns now show their atmospheric deployment context where it applies.",
      },
      {
        type: "fix",
        description:
          "Deployment toggle now shows the selected option's label instead of its raw value.",
      },
    ],
  },
  {
    date: "2026-05-01",
    changes: [
      {
        type: "refactor",
        description:
          "Hardened API mutations and retired the standalone screenshot service.",
      },
    ],
  },
  {
    date: "2026-04-30",
    changes: [
      {
        type: "feat",
        description:
          "Redesigned landing page built around real game data instead of placeholder content.",
      },
      {
        type: "feat",
        description:
          "Unified keyboard shortcut system, with a cheat-sheet (press ?) so you can discover what's available.",
      },
      {
        type: "feat",
        description:
          "Embed mode improvements and a broader responsiveness pass.",
      },
      {
        type: "feat",
        description: "profit-taker.com can now embed Arsenyx builds.",
      },
      {
        type: "fix",
        description:
          "Builds sidebar scrolls again, and the embed button has been folded into a single share menu.",
      },
      {
        type: "refactor",
        description:
          "Security fixes across authorization, XSS, and CSRF, plus dependency advisory cleanup.",
      },
    ],
  },
  {
    date: "2026-04-29",
    changes: [
      {
        type: "feat",
        description:
          "Added a favicon and Apple touch icon so Arsenyx looks right in tabs and on home screens.",
      },
      {
        type: "fix",
        description:
          "Saved builds with stale wfcd image names now self-heal instead of showing broken cards.",
      },
      {
        type: "fix",
        description:
          "Innate exilus polarity is now counted toward forma usage and mod capacity.",
      },
    ],
  },
  {
    date: "2026-04-25",
    changes: [
      {
        type: "feat",
        description:
          "On tablets and smaller laptops, your stats and abilities now open in a popover so the mods get the full width of the page.",
      },
    ],
  },
  {
    date: "2026-04-24",
    changes: [
      {
        type: "feat",
        description: "Mobile compatibility pass across the app.",
      },
    ],
  },
  {
    date: "2026-04-19",
    changes: [
      {
        type: "feat",
        description:
          "Arsenyx rewrite — new stack, same build planner. More to come.",
      },
    ],
  },
]

const TYPE_LABELS: Record<ChangelogEntry["changes"][number]["type"], string> = {
  feat: "New",
  fix: "Fix",
  refactor: "Improved",
  chore: "Maintenance",
}

const TYPE_COLORS: Record<ChangelogEntry["changes"][number]["type"], string> = {
  feat: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  fix: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
  refactor:
    "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900 dark:bg-purple-950/60 dark:text-purple-200",
  chore:
    "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
}

const TYPE_ORDER: Record<ChangelogEntry["changes"][number]["type"], number> = {
  feat: 0,
  refactor: 1,
  fix: 2,
  chore: 3,
}

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
})

function ChangelogPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
            <p className="text-muted-foreground text-xl">
              What&apos;s new, fixed, and improved in Arsenyx.
            </p>
          </div>

          <div className="flex flex-col">
            {CHANGELOG.map((entry) => (
              <section
                key={entry.date}
                className="flex flex-col gap-4 border-t py-8 first:border-t-0 first:pt-0"
              >
                <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                  {new Date(entry.date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </h2>
                <ul className="flex flex-col gap-3">
                  {[...entry.changes]
                    .sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
                    .map((change, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex w-24 shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[change.type]}`}
                        >
                          {TYPE_LABELS[change.type]}
                        </span>
                        <span className="text-sm">{change.description}</span>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
