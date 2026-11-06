import { createFileRoute } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { CHANGELOG, type ChangelogEntry } from "@/data/changelog"
import { pageSeo } from "@/lib/seo"
import { cn } from "@/lib/util/utils"

type ChangeType = ChangelogEntry["changes"][number]["type"]

/** Per change type: badge label, colours, and order within a day. */
const TYPE_META: Record<
  ChangeType,
  { label: string; className: string; order: number }
> = {
  feat: {
    label: "New",
    className:
      "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
    order: 0,
  },
  refactor: {
    label: "Improved",
    className:
      "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900 dark:bg-purple-950/60 dark:text-purple-200",
    order: 1,
  },
  fix: {
    label: "Fix",
    className:
      "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
    order: 2,
  },
  chore: {
    label: "Maintenance",
    className:
      "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
    order: 3,
  },
}

export const Route = createFileRoute("/_app/changelog")({
  head: () => pageSeo("/changelog"),
  component: ChangelogPage,
})

function ChangelogPage() {
  return (
    <div className="wrap max-w-3xl flex-1 py-12">
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
                  .sort(
                    (a, b) => TYPE_META[a.type].order - TYPE_META[b.type].order,
                  )
                  .map((change, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "mt-0.5 w-24 shrink-0 rounded-md",
                          TYPE_META[change.type].className,
                        )}
                      >
                        {TYPE_META[change.type].label}
                      </Badge>
                      <span className="text-sm">{change.description}</span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
