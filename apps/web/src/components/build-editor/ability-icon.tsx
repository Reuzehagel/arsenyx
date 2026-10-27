import type { AbilityStat } from "@arsenyx/shared/warframe/types"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Undo2, Zap } from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import { TapPopover } from "@/components/tap-popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  helminthQuery,
  type HelminthAbility,
} from "@/lib/queries/helminth-query"
import { abilityStatRows, type AbilityTotals } from "@/lib/stats"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

import { StatText } from "../stat-text"

export function AbilityIcon({
  ability,
  isHelminth,
  canSubsume,
  onSelectHelminth,
  totals,
}: {
  ability: {
    uniqueName: string
    name: string
    description: string
    imageName?: string
    stats?: AbilityStat[]
  }
  isHelminth: boolean
  canSubsume: boolean
  onSelectHelminth: (ability: HelminthAbility | null) => void
  /** The build's ability totals; stats are hidden without them. */
  totals?: AbilityTotals
}) {
  const statList = totals && (
    <AbilityStatList
      ability={ability}
      isHelminth={isHelminth}
      totals={totals}
    />
  )
  const triggerButton = (
    <button
      type="button"
      className={cn(
        "bg-muted relative size-10 overflow-hidden rounded-sm border transition-colors",
        isHelminth
          ? "border-destructive/60"
          : "border-border hover:border-muted-foreground/60",
      )}
    >
      {ability.imageName ? (
        <img
          src={getImageUrl(ability.imageName)}
          alt={ability.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center">
          <Zap className="size-4" />
        </div>
      )}
    </button>
  )

  return (
    <TapPopover
      trigger={triggerButton}
      tooltipClassName="max-w-xs"
      popoverClassName={canSubsume ? "w-72" : "max-w-xs p-3"}
      tooltip={
        <>
          <p className="font-semibold">{ability.name}</p>
          <p className="text-muted-foreground mt-0.5 whitespace-pre-line">
            <StatText text={ability.description} />
          </p>
          {statList}
        </>
      }
      popover={(close) =>
        canSubsume ? (
          <Suspense
            fallback={<p className="text-muted-foreground text-xs">Loading…</p>}
          >
            <HelminthPicker
              isHelminth={isHelminth}
              onPick={(ab) => {
                onSelectHelminth(ab)
                close()
              }}
            />
          </Suspense>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{ability.name}</p>
            {isHelminth && (
              <p className="text-destructive text-xs">(Helminth)</p>
            )}
            <p className="text-muted-foreground text-xs whitespace-pre-line">
              <StatText text={ability.description} />
            </p>
            {statList}
          </div>
        )
      }
    />
  )
}

function AbilityStatList({
  ability,
  isHelminth,
  totals,
}: {
  ability: { uniqueName: string; stats?: AbilityStat[] }
  isHelminth: boolean
  totals: AbilityTotals
}) {
  // A subsumed ability restored from a saved build carries no stats (builds
  // persist only its identity), so read them from the Helminth catalog.
  const { data } = useQuery({ ...helminthQuery, enabled: isHelminth })
  const stats = isHelminth
    ? data?.find((a) => a.uniqueName === ability.uniqueName)?.stats
    : ability.stats
  if (!stats?.length) return null

  return (
    <div className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-xs">
      {abilityStatRows(stats, totals, isHelminth).map((row, i) =>
        row.heading ? (
          <p key={i} className="mt-1 font-semibold">
            {row.text}
          </p>
        ) : (
          <p
            key={i}
            className={cn(
              row.changed ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {row.text}
          </p>
        ),
      )}
      <p className="text-muted-foreground mt-1 text-[10px]">
        Max rank, from wiki.warframe.com
      </p>
    </div>
  )
}

function HelminthPicker({
  isHelminth,
  onPick,
}: {
  isHelminth: boolean
  onPick: (ability: HelminthAbility | null) => void
}) {
  const { data } = useSuspenseQuery(helminthQuery)
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.source.toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[10px] font-medium uppercase">
        Helminth
      </span>
      {isHelminth && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPick(null)}
          className="justify-start gap-2"
        >
          <Undo2 className="size-3" />
          Restore Original
        </Button>
      )}
      <Input
        placeholder="Search abilities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((a) => (
          <button
            key={a.uniqueName}
            type="button"
            onClick={() => onPick(a)}
            className="hover:bg-muted flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors"
          >
            {a.imageName ? (
              <img
                src={getImageUrl(a.imageName)}
                alt=""
                className="size-6 shrink-0 rounded-sm"
              />
            ) : (
              <div className="bg-muted size-6 shrink-0 rounded-sm" />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{a.name}</span>
              <span className="text-muted-foreground truncate text-[10px]">
                {a.source}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="text-muted-foreground px-1.5 py-1 text-xs">
            No matches.
          </span>
        )}
      </div>
    </div>
  )
}
