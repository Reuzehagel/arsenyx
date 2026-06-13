import {
  groupConflictingMods,
  type ModConflictMap,
} from "@arsenyx/shared/warframe/mods"
import { TriangleAlert } from "lucide-react"
import { useMemo } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/util/utils"

import type { PlacedMod, SlotId } from "./use-build-slots"

/**
 * Warns when a loadout stacks mutually-exclusive mods (e.g. Serration +
 * Amalgam Serration + Spectral Serration — variants of the same base the game
 * forbids together). Non-destructive: it only flags the problem, leaving the
 * mods in place. Shown in both the editor and the read-only viewer, so an
 * already-saved invalid build still surfaces the warning. Renders nothing for
 * a legal build.
 */
export function ModConflictBanner({
  placed,
  conflicts,
  className,
}: {
  placed: Partial<Record<SlotId, PlacedMod>>
  conflicts: ModConflictMap
  className?: string
}) {
  const groups = useMemo(() => {
    const entries = Object.values(placed).filter((p): p is PlacedMod =>
      Boolean(p),
    )
    const nameByUniqueName = new Map(
      entries.map((p) => [p.mod.uniqueName, p.mod.name]),
    )
    return groupConflictingMods(
      entries.map((p) => p.mod.uniqueName),
      conflicts,
    ).map((group) => group.map((un) => nameByUniqueName.get(un) ?? un))
  }, [placed, conflicts])

  if (groups.length === 0) return null

  return (
    <Alert
      variant="destructive"
      className={cn("border-destructive/40 bg-destructive/10", className)}
    >
      <TriangleAlert />
      <AlertTitle>
        {groups.length === 1
          ? "These mods can't be equipped together"
          : "Some mods can't be equipped together"}
      </AlertTitle>
      <AlertDescription>
        <ul className="ml-6 list-disc">
          {groups.map((group) => (
            <li key={group.join("|")}>Keep only one of: {group.join(", ")}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
