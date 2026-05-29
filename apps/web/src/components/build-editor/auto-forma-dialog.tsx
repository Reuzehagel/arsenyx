import type { Polarity } from "@arsenyx/shared/warframe/types"
import { ArrowRight, Sparkle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { capitalize } from "@/lib/util/utils"

import type { FullAutoFormaPlan } from "./multi-variant-auto-forma"
import { PolarityIcon } from "./polarity"
import type { PlacedMod, SlotId } from "./use-build-slots"

/** Human-readable slot name for the dialog. `aura-2` → "Aura 3" (one-based,
 * matching how the game numbers slots). Stance/exilus get their kind name;
 * normal slots get "Slot N" with one-based indexing. */
function slotLabel(id: SlotId): string {
  if (id === "exilus") return "Exilus"
  if (id === "stance") return "Stance"
  const aura = /^aura-(\d+)$/.exec(id)
  if (aura) return `Aura ${Number(aura[1]) + 1}`
  const normal = /^normal-(\d+)$/.exec(id)
  if (normal) return `Slot ${Number(normal[1]) + 1}`
  return id
}

function polarityLabel(p: Polarity): string {
  if (p === "any") return "Omni Forma"
  if (p === "universal") return "Universal (cleared)"
  return capitalize(p)
}

/** Diff one variant's `before` vs `after` placed maps into per-mod moves
 * for human-readable display. Each entry is "{Mod}: {srcSlot} → {dstSlot}". */
function diffArrangement(
  before: Partial<Record<SlotId, PlacedMod>>,
  after: Partial<Record<SlotId, PlacedMod>>,
): { modName: string; from: SlotId; to: SlotId }[] {
  // Map mod uniqueName → its slot in `after`.
  const afterByMod = new Map<string, SlotId>()
  for (const [id, mod] of Object.entries(after)) {
    if (mod) afterByMod.set(mod.mod.uniqueName, id as SlotId)
  }
  const moves: { modName: string; from: SlotId; to: SlotId }[] = []
  for (const [rawFrom, mod] of Object.entries(before)) {
    if (!mod) continue
    const to = afterByMod.get(mod.mod.uniqueName)
    if (!to) continue // Mod removed (shouldn't happen for auto-forma but be defensive)
    if (to !== rawFrom) {
      moves.push({ modName: mod.mod.name, from: rawFrom as SlotId, to })
    }
  }
  return moves
}

interface AutoFormaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: FullAutoFormaPlan
  /** Variant labels by index, for display. */
  variantLabels: string[]
  /** Original placed maps by variant index, used to diff against the plan's
   * arranged maps. */
  originalVariantSlots: Partial<Record<SlotId, PlacedMod>>[]
  onApply: () => void
}

export function AutoFormaDialog({
  open,
  onOpenChange,
  plan,
  variantLabels,
  originalVariantSlots,
  onApply,
}: AutoFormaDialogProps) {
  const formaSteps = plan.steps
  const regularFormas = formaSteps.filter((s) => s.polarity !== "any")
  const omniFormas = formaSteps.filter((s) => s.polarity === "any")
  // Pre-compute per-variant move lists (skip variants without moves).
  const moveLists = plan.rearrangements
    .map((arr) => ({
      arr,
      moves: diffArrangement(
        originalVariantSlots[arr.variantIndex] ?? {},
        arr.placed,
      ),
    }))
    .filter((m) => m.moves.length > 0)

  const stageBlurb =
    plan.stage === 2
      ? "Forma-only fitting failed for at least one variant. The planner found a fit by also moving mods between normal slots."
      : "Even with mod rearrangement, a regular-forma assignment couldn't fit every variant. Using Omni Forma on the slots flagged below makes them accept any mod polarity."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Auto-forma plan</DialogTitle>
          <DialogDescription>{stageBlurb}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          {regularFormas.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Forma ({regularFormas.length})
              </h4>
              <ul className="flex flex-col gap-1">
                {regularFormas.map((step) => (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 rounded-md border px-2 py-1"
                  >
                    <span className="font-medium">{slotLabel(step.id)}</span>
                    <ArrowRight className="text-muted-foreground size-3.5" />
                    <PolarityIcon polarity={step.polarity} className="size-4" />
                    <span>{polarityLabel(step.polarity)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {omniFormas.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                <Sparkle className="size-3.5" />
                Omni Forma ({omniFormas.length})
              </h4>
              <p className="text-muted-foreground text-xs">
                Omni Forma is a rarer in-game resource — only the slots below
                need it; the rest use regular forma.
              </p>
              <ul className="flex flex-col gap-1">
                {omniFormas.map((step) => (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 rounded-md border border-amber-600/30 bg-amber-50/30 px-2 py-1 dark:border-amber-400/30 dark:bg-amber-950/20"
                  >
                    <span className="font-medium">{slotLabel(step.id)}</span>
                    <ArrowRight className="text-muted-foreground size-3.5" />
                    <PolarityIcon polarity="any" className="size-4" />
                    <span>Universal</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {moveLists.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Mod rearrangement
              </h4>
              {moveLists.map(({ arr, moves }) => (
                <div key={arr.variantIndex} className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">
                    {variantLabels[arr.variantIndex] ??
                      `Variant ${arr.variantIndex + 1}`}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {moves.map((m, i) => (
                      <li
                        key={`${arr.variantIndex}-${i}`}
                        className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1"
                      >
                        <span className="font-medium">{m.modName}</span>
                        <span className="text-muted-foreground">
                          {slotLabel(m.from)}
                        </span>
                        <ArrowRight className="text-muted-foreground size-3.5" />
                        <span>{slotLabel(m.to)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply()
              onOpenChange(false)
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
