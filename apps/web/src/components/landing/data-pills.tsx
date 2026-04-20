import { useQuery } from "@tanstack/react-query"

import { metaQuery } from "@/lib/meta-query"
import { relativeTime } from "@/lib/relative-time"

export function DataPills() {
  const { data: meta } = useQuery(metaQuery)

  if (!meta) return null

  const totalIndexed = meta.itemCount + meta.modCount + meta.arcaneCount

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <Pill>
        <span
          className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
          aria-hidden
        />
        <span className="text-muted-foreground">
          WFCD synced · {relativeTime(meta.generatedAt)}
        </span>
      </Pill>
      <Pill>
        <span className="text-muted-foreground">
          {totalIndexed.toLocaleString()} items indexed
        </span>
      </Pill>
      {meta.gameUpdate && (
        <Pill>
          <span className="text-muted-foreground">
            Update {meta.gameUpdate}
          </span>
        </Pill>
      )}
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background/60 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 backdrop-blur">
      {children}
    </div>
  )
}
