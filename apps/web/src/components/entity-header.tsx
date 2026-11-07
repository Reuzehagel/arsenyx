import type { ReactNode } from "react"

/** Header card of a profile or org page: avatar, name line, blurb, a dated
 *  "Joined/Created" line and stat counters. */
export function EntityHeader({
  avatar,
  name,
  nameExtras,
  bio,
  children,
  dateLabel,
  date,
  stats,
  action,
}: {
  avatar: ReactNode
  name: string
  /** Inline after the name: handle, badges. */
  nameExtras: ReactNode
  bio: string | null
  /** Between the bio and the date line. */
  children?: ReactNode
  dateLabel: string
  /** ISO timestamp, rendered as month + year. */
  date: string
  stats: { label: string; value: number }[]
  action?: ReactNode
}) {
  const when = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  })
  return (
    <div className="bg-card flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className="max-w-full min-w-0 truncate text-2xl font-bold tracking-tight"
            title={name}
          >
            {name}
          </h1>
          {nameExtras}
        </div>
        {bio ? <p className="text-sm wrap-anywhere">{bio}</p> : null}
        {children}
        <span className="text-muted-foreground text-xs">
          {dateLabel} {when}
        </span>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-4 text-sm">
          {stats.map((s) => (
            <span key={s.label}>
              <span className="text-foreground font-semibold tabular-nums">
                {s.value.toLocaleString()}
              </span>{" "}
              {s.label}
            </span>
          ))}
        </div>
      </div>
      {action}
    </div>
  )
}
