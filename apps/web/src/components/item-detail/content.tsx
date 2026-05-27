import { Link as RouterLink } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

import { StatText } from "@/components/stat-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatPct,
  formatStat,
  getCategoryLabel,
  getImageUrl,
  type BrowseCategory,
  type DetailItem,
} from "@/lib/warframe"

import { TopBuildsSection } from "./top-builds-section"

export function ItemDetailContent({
  item,
  category,
  slug,
}: {
  item: DetailItem
  category: BrowseCategory
  slug: string
}) {
  const stats = statsFor(item, category)
  const abilities = abilitiesFor(item, category)
  const bg = getImageUrl(item.imageName)

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-8">
        <div className="border-border/50 relative isolate overflow-hidden rounded-2xl border">
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 blur-md"
            style={{ backgroundImage: `url(${bg})` }}
            aria-hidden
          />
          <div
            className="from-background/90 via-background/60 to-background/30 absolute inset-0 -z-10 bg-gradient-to-r"
            aria-hidden
          />
          <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:gap-8 md:p-12">
            <div className="bg-muted/40 ring-border/60 flex size-40 shrink-0 items-center justify-center self-center rounded-xl ring-1 backdrop-blur md:size-56 md:self-auto">
              <img
                src={bg}
                alt={item.name}
                fetchPriority="high"
                decoding="async"
                className="size-full object-contain p-3"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                {getCategoryLabel(category)}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                  {item.name}
                </h1>
                {item.vaulted && <Badge variant="outline">Vaulted</Badge>}
              </div>
              {item.description && (
                <p className="text-muted-foreground max-w-2xl text-base md:text-lg">
                  <StatText text={item.description} />
                </p>
              )}
              {stats.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {stats.map((s) => (
                    <StatPill key={s.label} label={s.label} value={s.value} />
                  ))}
                </div>
              )}
              {abilities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {abilities.map((a, i) => (
                    <Tooltip key={a.uniqueName}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            className="bg-muted/40 border-border/40 hover:bg-muted/70 hover:border-border inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors"
                          />
                        }
                      >
                        <span className="bg-background/60 text-muted-foreground flex size-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums">
                          {i + 1}
                        </span>
                        <span className="font-medium">{a.name}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-muted-foreground mt-1">
                          <StatText text={a.description} />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  size="lg"
                  render={
                    <RouterLink
                      to="/create"
                      search={{ item: slug, category }}
                    />
                  }
                >
                  Create Build
                </Button>
                <ItemMeta item={item} />
              </div>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Top community builds</h2>
            <RouterLink
              to="/builds"
              search={{ q: item.name, sort: "top" }}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
            >
              View all
              <ArrowRight className="size-3.5" />
            </RouterLink>
          </div>
          <TopBuildsSection item={item} />
        </section>
      </div>
    </TooltipProvider>
  )
}

function StatPill({
  label,
  value,
}: {
  label: string
  value: string | number | undefined
}) {
  if (value === undefined || value === null || value === "") return null
  const display = typeof value === "number" ? formatStat(value) : value
  return (
    <div className="bg-muted/40 border-border/40 inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-semibold tabular-nums">{display}</span>
    </div>
  )
}

function ItemMeta({ item }: { item: DetailItem }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {item.masteryReq !== undefined && item.masteryReq > 0 && (
        <span>
          Mastery{" "}
          <span className="text-foreground font-medium">
            MR {item.masteryReq}
          </span>
        </span>
      )}
      {item.type && (
        <span>
          Type <span className="text-foreground font-medium">{item.type}</span>
        </span>
      )}
    </div>
  )
}

const WARFRAME_CATEGORIES = new Set<BrowseCategory>(["warframes", "necramechs"])
const WEAPON_CATEGORIES = new Set<BrowseCategory>([
  "primary",
  "secondary",
  "melee",
  "companion-weapons",
  "archwing",
  "exalted-weapons",
])

type Stat = { label: string; value: string | number | undefined }

function statsFor(item: DetailItem, category: BrowseCategory): Stat[] {
  if (WARFRAME_CATEGORIES.has(category)) {
    return [
      { label: "Health", value: item.health },
      { label: "Shield", value: item.shield },
      { label: "Armor", value: item.armor },
      { label: "Energy", value: item.power },
      { label: "Sprint", value: item.sprintSpeed },
    ]
  }
  if (WEAPON_CATEGORIES.has(category)) {
    const rows: Stat[] = [
      { label: "Damage", value: item.totalDamage },
      { label: "Crit %", value: formatPct(item.criticalChance) },
      {
        label: "Crit x",
        value:
          item.criticalMultiplier !== undefined
            ? `${formatStat(item.criticalMultiplier)}x`
            : undefined,
      },
      { label: "Status", value: formatPct(item.procChance) },
      {
        label: "Fire Rate",
        value:
          item.fireRate !== undefined ? formatStat(item.fireRate) : undefined,
      },
      { label: "Magazine", value: item.magazineSize },
      {
        label: "Reload",
        value:
          item.reloadTime !== undefined
            ? `${formatStat(item.reloadTime)}s`
            : undefined,
      },
    ]
    if (category === "melee") rows.push({ label: "Range", value: item.range })
    return rows
  }
  return []
}

function abilitiesFor(item: DetailItem, category: BrowseCategory) {
  if (!WARFRAME_CATEGORIES.has(category)) return []
  return item.abilities ?? []
}
