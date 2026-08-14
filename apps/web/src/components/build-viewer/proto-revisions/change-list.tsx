/* PROTOTYPE — issue #331. Renders one revision's diff. Throwaway. */
import { useState } from "react"

import { cn } from "@/lib/util/utils"

import type { ProtoChange, ProtoChangeGroup } from "./stub-data"

/** Lines shown before collapsing. A fresh variant adds ~10 slots at once, and
 *  ten green lines in a 384px sheet drowns everything around it. */
const MAX_LINES = 4

const SIGIL: Record<ProtoChange["op"], string> = {
  add: "+",
  remove: "−",
  modify: "~",
  info: " ",
}

const TONE: Record<ProtoChange["op"], string> = {
  add: "text-positive",
  remove: "text-destructive",
  modify: "text-muted-foreground",
  info: "text-muted-foreground italic",
}

function Line({ change }: { change: ProtoChange }) {
  return (
    <li className={cn("flex gap-1.5 font-mono text-[11px]", TONE[change.op])}>
      <span aria-hidden className="w-2 shrink-0 select-none">
        {SIGIL[change.op]}
      </span>
      <span className="min-w-0">
        {change.label}
        {"detail" in change && change.detail ? (
          <span className="text-muted-foreground/70"> · {change.detail}</span>
        ) : null}
      </span>
    </li>
  )
}

export function ChangeList({ groups }: { groups: ProtoChangeGroup[] }) {
  const [expanded, setExpanded] = useState(false)
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const overflow = total - MAX_LINES

  let budget = expanded ? Infinity : MAX_LINES
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {groups.map((g, gi) => {
        const take = Math.max(0, Math.min(g.items.length, budget))
        budget -= take
        if (take === 0) return null
        return (
          <div key={g.scope ?? gi}>
            {g.scope ? (
              <p className="text-muted-foreground/60 mb-0.5 text-[10px] tracking-wide uppercase">
                {g.scope}
              </p>
            ) : null}
            <ul className="flex flex-col gap-px">
              {g.items.slice(0, take).map((c, i) => (
                <Line key={`${c.op}-${c.label}-${i}`} change={c} />
              ))}
            </ul>
          </div>
        )
      })}
      {overflow > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground cursor-pointer self-start font-mono text-[10px] underline underline-offset-2"
        >
          {expanded ? "show less" : `+${overflow} more`}
        </button>
      ) : null}
    </div>
  )
}
