import { clamp } from "@arsenyx/shared"
import {
  RIVEN_MAX_DRAIN,
  RIVEN_MIN_DRAIN,
  RIVEN_POLARITIES,
  getRivenStatsFor,
} from "@arsenyx/shared/warframe/rivens"
import type {
  BrowseCategory,
  Polarity,
  RivenStats,
} from "@arsenyx/shared/warframe/types"
import { useCallback, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { PolarityIcon } from "./polarity"

interface StatRowState {
  stat: string | null
  value: string
}

export interface RivenDialogValues {
  rivenStats: RivenStats
  drain: number
  polarity: Polarity
}

interface RivenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (values: RivenDialogValues) => void
  category: BrowseCategory
  initialValues?: Partial<RivenDialogValues>
}

function emptyPositives(init?: RivenStats): StatRowState[] {
  const arr = init?.positives ?? []
  return [0, 1, 2].map((i) => ({
    stat: arr[i]?.stat ?? null,
    value: arr[i] ? String(arr[i]!.value) : "",
  }))
}

function emptyNegative(init?: RivenStats): StatRowState {
  const n = init?.negatives?.[0]
  return { stat: n?.stat ?? null, value: n ? String(n.value) : "" }
}

function clampDrain(raw: string): number {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return RIVEN_MIN_DRAIN
  return clamp(n, RIVEN_MIN_DRAIN, RIVEN_MAX_DRAIN)
}

export function RivenDialog({
  open,
  onOpenChange,
  onConfirm,
  category,
  initialValues,
}: RivenDialogProps) {
  const [polarity, setPolarity] = useState<Polarity>(
    initialValues?.polarity ?? "madurai",
  )
  const [drain, setDrain] = useState(
    String(initialValues?.drain ?? RIVEN_MIN_DRAIN),
  )
  const [positives, setPositives] = useState<StatRowState[]>(() =>
    emptyPositives(initialValues?.rivenStats),
  )
  const [negative, setNegative] = useState<StatRowState>(() =>
    emptyNegative(initialValues?.rivenStats),
  )

  const statOptions = useMemo(() => getRivenStatsFor(category), [category])

  const allSelected = useMemo(() => {
    const s = new Set<string>()
    for (const r of positives) if (r.stat) s.add(r.stat)
    if (negative.stat) s.add(negative.stat)
    return s
  }, [positives, negative])

  const updatePositive = useCallback(
    (index: number, patch: Partial<StatRowState>) => {
      setPositives((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], ...patch }
        return next
      })
    },
    [],
  )

  const handleConfirm = useCallback(() => {
    const drainNum = clampDrain(drain)
    const stats: RivenStats = {
      positives: positives
        .filter((r) => r.stat && r.value)
        .map((r) => ({
          stat: r.stat!,
          value: Math.abs(parseFloat(r.value) || 0),
        })),
      negatives:
        negative.stat && negative.value
          ? [
              {
                stat: negative.stat,
                value: -Math.abs(parseFloat(negative.value) || 0),
              },
            ]
          : [],
    }
    onConfirm({ rivenStats: stats, drain: drainNum, polarity })
  }, [positives, negative, drain, polarity, onConfirm])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Riven Mod</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <Field className="flex-1">
              <FieldLabel className="text-xs">Polarity</FieldLabel>
              <ToggleGroup
                value={[polarity]}
                onValueChange={(v) => {
                  const next = v[0]
                  if (next) setPolarity(next as Polarity)
                }}
                variant="outline"
                size="sm"
                className="flex gap-1"
              >
                {RIVEN_POLARITIES.map((p) => (
                  <ToggleGroupItem
                    key={p}
                    value={p}
                    className="data-pressed:border-primary/60 data-pressed:ring-primary/60 h-8 flex-1 capitalize data-pressed:ring-1"
                  >
                    <PolarityIcon polarity={p} className="size-3.5" />
                    {p}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field className="w-24">
              <FieldLabel className="text-xs" htmlFor="riven-drain">
                Drain
              </FieldLabel>
              <Input
                id="riven-drain"
                type="number"
                value={drain}
                onChange={(e) => setDrain(e.target.value)}
                onBlur={() => setDrain(String(clampDrain(drain)))}
                min={RIVEN_MIN_DRAIN}
                max={RIVEN_MAX_DRAIN}
                className="h-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel className="block text-xs text-green-400">
              Positives
            </FieldLabel>
            <div className="flex flex-col gap-2">
              {positives.map((row, i) => (
                <StatRow
                  key={i}
                  row={row}
                  options={statOptions}
                  allSelected={allSelected}
                  onChangeStat={(s) => updatePositive(i, { stat: s })}
                  onChangeValue={(v) => updatePositive(i, { value: v })}
                />
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel className="block text-xs text-red-400">
              Negative
            </FieldLabel>
            <StatRow
              row={negative}
              options={statOptions}
              allSelected={allSelected}
              onChangeStat={(s) => setNegative((p) => ({ ...p, stat: s }))}
              onChangeValue={(v) => setNegative((p) => ({ ...p, value: v }))}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatRow({
  row,
  options,
  allSelected,
  onChangeStat,
  onChangeValue,
}: {
  row: StatRowState
  options: readonly string[]
  allSelected: Set<string>
  onChangeStat: (s: string | null) => void
  onChangeValue: (v: string) => void
}) {
  const visible = options.filter((s) => s === row.stat || !allSelected.has(s))
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        value={row.value}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder="0"
        step="0.1"
        className="h-8 w-24 shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Combobox
        items={visible}
        value={row.stat}
        onValueChange={(v) => onChangeStat((v as string | null) ?? null)}
      >
        <ComboboxInput
          placeholder="Select stat…"
          className="h-8 flex-1"
          showClear={!!row.stat}
        />
        <ComboboxContent>
          <ComboboxEmpty>No stats found</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
