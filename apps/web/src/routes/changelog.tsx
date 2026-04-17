import { createFileRoute } from "@tanstack/react-router";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

interface ChangelogEntry {
  date: string;
  version?: string;
  changes: {
    type: "feat" | "fix" | "refactor" | "chore";
    description: string;
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-04-17",
    changes: [
      {
        type: "refactor",
        description:
          "Begin migration from Next.js to Vite + TanStack Router — homepage, browse (with filters/sort), and static pages ported",
      },
      {
        type: "feat",
        description:
          "Item detail pages — per-item static JSON served from the CDN, no backend required",
      },
      {
        type: "feat",
        description: "Press / to focus the search input on the Browse page",
      },
      {
        type: "feat",
        description:
          "Build editor shell — /create?item=… with item sidebar and breadcrumb (mod editor + save land in follow-up slices)",
      },
      {
        type: "feat",
        description:
          "Compatible Mods grid — 2-row horizontal scroll with search, sort, and rarity/polarity filters; positions stay stable when filtering (no reshuffling)",
      },
    ],
  },
  {
    date: "2026-04-16",
    changes: [
      {
        type: "feat",
        description:
          "Zaw support — select Grip and Link components for Zaw Strike builds with dynamic stat recalculation",
      },
      {
        type: "fix",
        description:
          "Fixed Zaw Strikes showing no mods and zero stats on the browse page",
      },
    ],
  },
  {
    date: "2026-04-15",
    changes: [
      {
        type: "feat",
        description:
          "Riven mod support — add and configure Riven mods on weapon builds with custom stats, drain, and polarity",
      },
    ],
  },
  {
    date: "2026-04-13",
    changes: [
      {
        type: "fix",
        description:
          "Fixed mobile drag-and-drop in mod editor — vertical dragging no longer triggers page scroll",
      },
      {
        type: "fix",
        description: "Carry over subsumed helminth ability when forking a build",
      },
      {
        type: "feat",
        description: "Added sort options to profile and organization pages",
      },
      {
        type: "fix",
        description: "Improved mobile layout for build editor and navigation",
      },
      {
        type: "refactor",
        description: "Extracted shared sort constants and improved type safety",
      },
    ],
  },
  {
    date: "2026-04-12",
    changes: [
      {
        type: "fix",
        description:
          "Support dual aura slots (Jade), fix build save validation, and correct archwing layouts",
      },
      {
        type: "fix",
        description: "Reduced mod card rarity color overlay opacity for subtler tint",
      },
      {
        type: "feat",
        description: "Added delete build button with confirmation dialog",
      },
      {
        type: "fix",
        description: "Revalidate browse and builds pages after build deletion",
      },
      {
        type: "fix",
        description: "Fixed helminth augment mod hydration and build codec encoding",
      },
      {
        type: "refactor",
        description:
          "Deduplicated code, removed dead code, and migrated to Prisma 7",
      },
      {
        type: "feat",
        description:
          "Added grid/list view toggle for build lists with author info and dates",
      },
      {
        type: "feat",
        description:
          "Made organization and user names clickable links on build cards",
      },
    ],
  },
  {
    date: "2026-04-11",
    changes: [
      {
        type: "fix",
        description:
          "Improved mod card name readability with darker background and stronger text shadow",
      },
      {
        type: "feat",
        description: "Added format option to screenshot API, default to WebP",
      },
      {
        type: "fix",
        description:
          "Show stats for companions, exalted weapons, and companion weapons",
      },
      {
        type: "chore",
        description: "Updated @wfcd/items to 1.1273.17 (Voruna Prime)",
      },
      {
        type: "fix",
        description:
          "Fixed weapon Overframe import, mod filtering, and Kuva/Tenet capacity",
      },
    ],
  },
  {
    date: "2026-04-10",
    changes: [
      {
        type: "feat",
        description:
          "Added communities tab to admin panel and clickable usernames",
      },
      {
        type: "feat",
        description: "Show helminth augment mods for subsumed abilities",
      },
      {
        type: "fix",
        description: "Set username from GitHub profile on OAuth sign-in",
      },
    ],
  },
  {
    date: "2026-04-09",
    changes: [
      {
        type: "feat",
        description: "Added build screenshot API with API key authentication",
      },
      {
        type: "feat",
        description: "Added API key management tab to admin panel",
      },
    ],
  },
];

const TYPE_LABELS: Record<ChangelogEntry["changes"][number]["type"], string> = {
  feat: "New",
  fix: "Fix",
  refactor: "Improved",
  chore: "Maintenance",
};

const TYPE_COLORS: Record<ChangelogEntry["changes"][number]["type"], string> = {
  feat: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  fix: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
  refactor: "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900 dark:bg-purple-950/60 dark:text-purple-200",
  chore: "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
};

const TYPE_ORDER: Record<ChangelogEntry["changes"][number]["type"], number> = {
  feat: 0,
  refactor: 1,
  fix: 2,
  chore: 3,
};

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="container max-w-3xl flex-1 py-12">
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
                  {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
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
  );
}
