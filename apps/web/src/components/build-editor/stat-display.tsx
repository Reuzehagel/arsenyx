import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  formatWithSign,
  type StatContribution,
  type StatValue,
} from "@/lib/stats"
import { cn } from "@/lib/util/utils"
import { formatStat } from "@/lib/warframe"

export function groupContributions(
  contribs: StatContribution[],
): { label: string; contribs: StatContribution[] }[] {
  const groups = new Map<string, StatContribution[]>()
  for (const c of contribs) {
    const key = c.group ?? ""
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return Array.from(groups, ([label, contribs]) => ({ label, contribs }))
}

export function formatSum(contribs: StatContribution[]): string {
  const sum = contribs.reduce((t, c) => t + c.amount, 0)
  const sign = sum >= 0 ? "+" : ""
  return `${sign}${formatStat(sum, 1)}%`
}

export function formatContribAmount(c: StatContribution): string {
  return formatWithSign(c.amount, 1, c.operation === "percent_add" ? "%" : "")
}

export function StatLine({
  label,
  value,
  unit = "",
  digits = 2,
  inverted = false,
  emphasis = false,
}: {
  label: string
  value: StatValue
  unit?: string
  digits?: number
  inverted?: boolean
  emphasis?: boolean
}) {
  const delta = value.modified - value.base
  const changed = Math.abs(delta) > 0.005
  const capped = value.uncapped !== undefined
  const better = inverted ? delta < 0 : delta > 0
  const color = !changed ? "" : better ? "text-green-500" : "text-red-500"

  const row = (
    <div
      className={cn(
        "flex items-baseline justify-between",
        changed && "cursor-help",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold" : "font-medium",
          color,
        )}
      >
        {formatStat(value.modified, digits)}
        {unit}
        {capped && (
          <span className="text-muted-foreground ml-1 text-[10px] font-normal">
            ({formatStat(value.uncapped!, digits)}
            {unit})
          </span>
        )}
      </span>
    </div>
  )

  if (!changed || value.contributions.length === 0) return row

  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={row} />
      <PopoverContent side="right" align="start" className="w-64 text-xs">
        <StatFormula
          value={value}
          unit={unit}
          digits={digits}
          inverted={inverted}
        />
      </PopoverContent>
    </Popover>
  )
}

function StatFormula({
  value,
  unit,
  digits,
  inverted,
}: {
  value: StatValue
  unit: string
  digits: number
  inverted: boolean
}) {
  const hasGroups = value.contributions.some((c) => c.group)
  const flats = value.contributions.filter((c) => c.operation === "flat_add")
  const percents = value.contributions.filter(
    (c) => c.operation === "percent_add",
  )
  const percentSum = percents.reduce((s, c) => s + c.amount, 0)
  const flatSum = flats.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground">Base</span>
        <span className="tabular-nums">
          {formatStat(value.base, digits)}
          {unit}
        </span>
      </div>

      {hasGroups ? (
        <GroupedContribs contribs={value.contributions} />
      ) : (
        <>
          {percents.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-0.5">
                {percents.map((c, i) => (
                  <ContribRow
                    key={`p-${i}`}
                    name={c.name}
                    amount={formatContribAmount(c)}
                    positive={c.amount > 0}
                  />
                ))}
              </div>
            </>
          )}

          {flats.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-0.5">
                {flats.map((c, i) => (
                  <ContribRow
                    key={`f-${i}`}
                    name={c.name}
                    amount={formatWithSign(c.amount, digits, unit)}
                    positive={c.amount > 0}
                  />
                ))}
              </div>
            </>
          )}

          <Separator />
          <div className="text-muted-foreground text-[10px]">
            {inverted ? (
              <>
                {formatStat(value.base, digits)} ÷ (1 +{" "}
                {formatStat(percentSum / 100, 2)})
              </>
            ) : (
              <>
                {formatStat(value.base, digits)} × (1 +{" "}
                {formatStat(percentSum / 100, 2)})
                {flatSum !== 0 && ` + ${formatStat(flatSum, digits)}`}
              </>
            )}
          </div>
        </>
      )}

      <Separator />
      {value.uncapped !== undefined && (
        <div className="text-muted-foreground flex items-baseline justify-between">
          <span>Uncapped</span>
          <span className="tabular-nums">
            {formatStat(value.uncapped, digits)}
            {unit}
          </span>
        </div>
      )}
      <div className="flex items-baseline justify-between font-medium">
        <span>{value.uncapped !== undefined ? "Capped" : "Total"}</span>
        <span className="tabular-nums">
          {formatStat(value.modified, digits)}
          {unit}
        </span>
      </div>
    </div>
  )
}

export function GroupedContribs({
  contribs,
}: {
  contribs: StatContribution[]
}) {
  const groups = groupContributions(contribs)
  return (
    <>
      {groups.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <Separator />
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {g.label || "Other"}{" "}
            <span className="tabular-nums">({formatSum(g.contribs)})</span>
          </div>
          {g.contribs.map((c, j) => (
            <ContribRow
              key={j}
              name={c.name}
              amount={formatContribAmount(c)}
              positive={c.amount > 0}
            />
          ))}
        </div>
      ))}
    </>
  )
}

export function ContribRow({
  name,
  amount,
  positive,
}: {
  name: string
  amount: string
  positive: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground truncate">{name}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          positive ? "text-green-500" : "text-red-500",
        )}
      >
        {amount}
      </span>
    </div>
  )
}
