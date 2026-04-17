"use client"

import { useState, useCallback } from "react"

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { RIVEN_STATS } from "@/lib/warframe/rivens"
import type { Polarity, RivenStats } from "@/lib/warframe/types"

const RIVEN_POLARITIES: { value: Polarity; label: string }[] = [
  { value: "madurai", label: "Madurai" },
  { value: "naramon", label: "Naramon" },
  { value: "vazarin", label: "Vazarin" },
]

interface RivenStatRow {
  stat: string | null
  value: string
}

interface RivenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (config: {
    rivenStats: RivenStats
    drain: number
    polarity: Polarity
  }) => void
  initialValues?: {
    rivenStats?: RivenStats
    drain?: number
    polarity?: Polarity
  }
}

export function RivenDialog({
  open,
  onOpenChange,
  onConfirm,
  initialValues,
}: RivenDialogProps) {
  const [polarity, setPolarity] = useState<Polarity>(
    initialValues?.polarity ?? "madurai",
  )
  const [drain, setDrain] = useState(String(initialValues?.drain ?? 0))
  const [positives, setPositives] = useState<RivenStatRow[]>(() => {
    const init = initialValues?.rivenStats?.positives ?? []
    return [
      {
        stat: init[0]?.stat ?? null,
        value: init[0] ? String(init[0].value) : "",
      },
      {
        stat: init[1]?.stat ?? null,
        value: init[1] ? String(init[1].value) : "",
      },
      {
        stat: init[2]?.stat ?? null,
        value: init[2] ? String(init[2].value) : "",
      },
    ]
  })
  const [negative, setNegative] = useState<RivenStatRow>(() => {
    const init = initialValues?.rivenStats?.negatives?.[0]
    return { stat: init?.stat ?? null, value: init ? String(init.value) : "" }
  })

  const handleConfirm = useCallback(() => {
    const rivenStats: RivenStats = {
      positives: positives
        .filter((r) => r.stat && r.value)
        .map((r) => ({ stat: r.stat!, value: parseFloat(r.value) || 0 })),
      negatives:
        negative.stat && negative.value
          ? [{ stat: negative.stat, value: parseFloat(negative.value) || 0 }]
          : [],
    }

    onConfirm({
      rivenStats,
      drain: parseInt(drain) || 0,
      polarity,
    })
  }, [positives, negative, drain, polarity, onConfirm])

  const updatePositive = (
    index: number,
    field: "stat" | "value",
    val: string | null,
  ) => {
    setPositives((prev) => {
      const next = [...prev]
      if (field === "stat") {
        next[index] = { ...next[index], stat: val }
      } else {
        next[index] = { ...next[index], value: val ?? "" }
      }
      return next
    })
  }

  // Collect all currently selected stats for uniqueness enforcement
  const allSelectedStats = new Set(
    [...positives, negative]
      .map((r) => r.stat)
      .filter((s): s is string => s !== null),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Riven Mod</DialogTitle>
        </DialogHeader>

        <FieldGroup className="gap-4">
          {/* Polarity & Drain */}
          <div className="flex gap-4">
            <Field className="flex-1">
              <FieldLabel className="mb-1.5 text-xs">Polarity</FieldLabel>
              <ToggleGroup
                value={[polarity]}
                onValueChange={(v) => {
                  if (v[0]) setPolarity(v[0] as Polarity)
                }}
                className="w-full"
              >
                {RIVEN_POLARITIES.map((p) => (
                  <ToggleGroupItem
                    key={p.value}
                    value={p.value}
                    className="flex-1"
                  >
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field className="w-20">
              <FieldLabel className="mb-1.5 text-xs">Drain</FieldLabel>
              <Input
                type="number"
                value={drain}
                onChange={(e) => setDrain(e.target.value)}
                min={0}
                className="h-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </Field>
          </div>

          {/* Positives */}
          <Field>
            <FieldLabel className="mb-1.5 text-xs text-green-400">
              Positives
            </FieldLabel>
            <div className="flex flex-col gap-2">
              {positives.map((row, i) => (
                <StatRow
                  key={i}
                  stat={row.stat}
                  value={row.value}
                  disabledStats={allSelectedStats}
                  onStatChange={(s) => updatePositive(i, "stat", s)}
                  onValueChange={(v) => updatePositive(i, "value", v)}
                />
              ))}
            </div>
          </Field>

          {/* Negatives */}
          <Field>
            <FieldLabel className="mb-1.5 text-xs text-red-400">
              Negatives
            </FieldLabel>
            <StatRow
              stat={negative.stat}
              value={negative.value}
              disabledStats={allSelectedStats}
              onStatChange={(s) => setNegative((prev) => ({ ...prev, stat: s }))}
              onValueChange={(v) =>
                setNegative((prev) => ({ ...prev, value: v }))
              }
            />
          </Field>
        </FieldGroup>

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

interface StatRowProps {
  stat: string | null
  value: string
  disabledStats: Set<string>
  onStatChange: (stat: string | null) => void
  onValueChange: (value: string) => void
}

function StatRow({ stat, value, disabledStats, onStatChange, onValueChange }: StatRowProps) {
  const availableStats = RIVEN_STATS.filter(
    (s) => s === stat || !disabledStats.has(s),
  )

  return (
    <div className="flex gap-2">
      <Input
        type="number"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="0"
        className="h-8 w-20 shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex-1">
        <Combobox
          value={stat}
          onValueChange={(val) => onStatChange(val)}
          items={availableStats}
        >
          <ComboboxInput placeholder="Select stat..." className="h-8" />
          <ComboboxContent>
            <ComboboxEmpty>No stats found</ComboboxEmpty>
            <ComboboxList>
              {(item) => (
                <ComboboxItem key={item} value={item}>
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  )
}
