import { clamp } from "@arsenyx/shared/util/math"
import {
  RIVEN_DEFAULT_DRAIN,
  RIVEN_MAX_DRAIN,
  RIVEN_MIN_DRAIN,
  RIVEN_POLARITIES,
  getRivenStatsFor,
  isSplicedRivenStat,
} from "@arsenyx/shared/warframe/rivens"
import type {
  BrowseCategory,
  Polarity,
  RivenStats,
} from "@arsenyx/shared/warframe/types"
import { useCallback, useMemo, useState } from "react"

import { PolarityIcon } from "@/components/build-loadout/polarity"
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

/** Parses a typed stat value, accepting a comma decimal ("12,5"). NaN when
 *  it isn't a number. */
function parseStat(raw: string): number {
  return Number(raw.trim().replace(",", "."))
}

/** Magnitude of a single riven stat roll, as a percentage. Keeps absurd
 *  values out of the stat engine — real roll ranges are far narrower than the
 *  cap. The sign comes from the row (positive or negative), not the input. */
function clampStatMagnitude(raw: string): number {
  const n = Math.abs(parseStat(raw))
  if (!Number.isFinite(n)) return 0
  return clamp(n, 0, RIVEN_MAX_STAT_MAGNITUDE)
}

type RowStatus = "empty" | "complete" | "incomplete"

/** A row counts only with both a stat and a number; half-filled rows block
 *  Confirm instead of being silently dropped. */
function rowStatus(r: StatRowState): RowStatus {
  const hasValue = r.value.trim() !== ""
  if (!r.stat && !hasValue) return "empty"
  return r.stat && hasValue && Number.isFinite(parseStat(r.value))
    ? "complete"
    : "incomplete"
}

const RIVEN_MAX_STAT_MAGNITUDE = 999

function clampDrain(raw: string): number {
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return RIVEN_DEFAULT_DRAIN
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
    String(initialValues?.drain ?? RIVEN_DEFAULT_DRAIN),
  )
  const [positives, setPositives] = useState<StatRowState[]>(() =>
    emptyPositives(initialValues?.rivenStats),
  )
  const [negative, setNegative] = useState<StatRowState>(() =>
    emptyNegative(initialValues?.rivenStats),
  )

  const statOptions = useMemo(() => getRivenStatsFor(category), [category])
  const negativeOptions = useMemo(
    () => statOptions.filter((s) => !isSplicedRivenStat(s)),
    [statOptions],
  )

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

  const statuses = [...positives, negative].map(rowStatus)
  const anyIncomplete = statuses.includes("incomplete")
  const anyComplete = statuses.includes("complete")
  const canConfirm = anyComplete && !anyIncomplete
  // Once something's typed, a stray click outside mustn't throw it away
  // (Escape and Cancel still close).
  const dirty = statuses.some((st) => st !== "empty")

  const handleConfirm = useCallback(() => {
    const drainNum = clampDrain(drain)
    const stats: RivenStats = {
      positives: positives
        .filter((r) => rowStatus(r) === "complete")
        .map((r) => ({
          stat: r.stat!,
          value: clampStatMagnitude(r.value),
        })),
      negatives:
        rowStatus(negative) === "complete"
          ? [
              {
                stat: negative.stat!,
                value: -clampStatMagnitude(negative.value),
              },
            ]
          : [],
    }
    onConfirm({ rivenStats: stats, drain: drainNum, polarity })
  }, [positives, negative, drain, polarity, onConfirm])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal={dirty}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Riven Mod</DialogTitle>
        </DialogHeader>

        {/* A form so Enter in any field confirms. */}
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (canConfirm) handleConfirm()
          }}
        >
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
                    label={`Positive ${i + 1}`}
                    autoFocus={i === 0}
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
                label="Negative"
                row={negative}
                options={negativeOptions}
                allSelected={allSelected}
                onChangeStat={(s) => setNegative((p) => ({ ...p, stat: s }))}
                onChangeValue={(v) => setNegative((p) => ({ ...p, value: v }))}
              />
            </Field>
          </div>

          <DialogFooter className="items-center">
            {anyIncomplete ? (
              <p className="text-muted-foreground mr-auto text-xs">
                Each stat needs both a name and a number.
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canConfirm}>
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StatRow({
  label,
  autoFocus,
  row,
  options,
  allSelected,
  onChangeStat,
  onChangeValue,
}: {
  label: string
  autoFocus?: boolean
  row: StatRowState
  options: readonly string[]
  allSelected: Set<string>
  onChangeStat: (s: string | null) => void
  onChangeValue: (v: string) => void
}) {
  const visible = options.filter((s) => s === row.stat || !allSelected.has(s))
  const invalid = rowStatus(row) === "incomplete"
  return (
    <div className="flex gap-2">
      {/* Text, not number: a number input silently empties on "12,5". */}
      <Input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        aria-label={`${label} value`}
        aria-invalid={invalid || undefined}
        value={row.value}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder="0"
        className="h-8 w-24 shrink-0"
      />
      <Combobox
        items={visible}
        value={row.stat}
        onValueChange={(v) => onChangeStat((v as string | null) ?? null)}
      >
        <ComboboxInput
          aria-label={`${label} stat`}
          aria-invalid={invalid || undefined}
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
