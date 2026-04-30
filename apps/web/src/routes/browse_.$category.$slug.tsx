import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  notFound,
  Link as RouterLink,
} from "@tanstack/react-router"
import { Suspense } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { itemQuery } from "@/lib/item-query"
import {
  CATEGORIES,
  formatPct,
  formatStat,
  getImageUrl,
  isValidCategory,
  type BrowseCategory,
} from "@/lib/warframe"

export const Route = createFileRoute("/browse_/$category/$slug")({
  beforeLoad: ({ params }) => {
    if (!isValidCategory(params.category)) throw notFound()
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      itemQuery(params.category as BrowseCategory, params.slug),
    ),
  component: ItemDetailPage,
  notFoundComponent: ItemNotFound,
})

function ItemDetailPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col gap-8 py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading item…</p>}
          >
            <ItemDetailContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function ItemDetailContent() {
  const { category, slug } = Route.useParams()
  const cat = category as BrowseCategory
  const { data: item } = useSuspenseQuery(itemQuery(cat, slug))
  const categoryLabel = CATEGORIES.find((c) => c.id === cat)?.label ?? cat

  const isWarframe = cat === "warframes" || cat === "necramechs"
  const isWeapon =
    cat === "primary" ||
    cat === "secondary" ||
    cat === "melee" ||
    cat === "companion-weapons" ||
    cat === "archwing" ||
    cat === "exalted-weapons"
  const isMelee = cat === "melee"

  return (
    <>
      <nav className="text-muted-foreground flex items-center gap-2 text-sm">
        <RouterLink
          to="/browse"
          search={{ category: "warframes" }}
          className="hover:text-foreground transition-colors"
        >
          Browse
        </RouterLink>
        <span>/</span>
        <RouterLink
          to="/browse"
          search={{ category: cat }}
          className="hover:text-foreground transition-colors"
        >
          {categoryLabel}
        </RouterLink>
        <span>/</span>
        <span className="text-foreground">{item.name}</span>
      </nav>

      <div className="flex flex-col gap-8 md:flex-row">
        <div className="shrink-0">
          <div className="bg-muted/30 relative flex size-48 items-center justify-center rounded-xl border md:h-64 md:w-64">
            <img
              src={getImageUrl(item.imageName)}
              alt={item.name}
              width={256}
              height={256}
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
              {item.vaulted && <Badge variant="outline">Vaulted</Badge>}
            </div>
            {item.description && (
              <p className="text-muted-foreground max-w-2xl">
                {item.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {item.masteryReq !== undefined && item.masteryReq > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Mastery:</span>
                <span className="font-medium">MR {item.masteryReq}</span>
              </div>
            )}
            {item.type && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium">{item.type}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button
              size="lg"
              render={
                <RouterLink
                  to="/create"
                  search={{ item: slug, category: cat }}
                />
              }
            >
              Create Build
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isWarframe && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Base Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <StatItem label="Health" value={item.health} />
                <StatItem label="Shield" value={item.shield} />
                <StatItem label="Armor" value={item.armor} />
                <StatItem label="Energy" value={item.power} />
                <StatItem label="Sprint" value={item.sprintSpeed} />
              </dl>
            </CardContent>
          </Card>
        )}

        {isWeapon && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weapon Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <StatItem label="Damage" value={item.totalDamage} />
                <StatItem
                  label="Crit Chance"
                  value={formatPct(item.criticalChance)}
                />
                <StatItem
                  label="Crit Multi"
                  value={
                    item.criticalMultiplier !== undefined
                      ? `${item.criticalMultiplier}x`
                      : undefined
                  }
                />
                <StatItem label="Status" value={formatPct(item.procChance)} />
                <StatItem
                  label="Fire Rate"
                  value={
                    item.fireRate !== undefined
                      ? formatStat(item.fireRate, 3)
                      : undefined
                  }
                />
                <StatItem label="Magazine" value={item.magazineSize} />
                <StatItem
                  label="Reload"
                  value={
                    item.reloadTime !== undefined
                      ? `${formatStat(item.reloadTime)}s`
                      : undefined
                  }
                />
                {isMelee && <StatItem label="Range" value={item.range} />}
              </dl>
            </CardContent>
          </Card>
        )}

        {isWarframe && item.abilities && item.abilities.length > 0 && (
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Abilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {item.abilities.map((ability, index) => (
                  <div key={ability.uniqueName} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {index + 1}
                      </span>
                      <span className="font-medium">{ability.name}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {ability.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function ItemNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap flex flex-col items-center gap-4 py-20 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Item not found</h1>
          <p className="text-muted-foreground">
            We couldn't find an item at that path.
          </p>
          <Button
            render={
              <RouterLink to="/browse" search={{ category: "warframes" }} />
            }
          >
            Back to Browse
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function StatItem({
  label,
  value,
}: {
  label: string
  value: string | number | undefined
}) {
  if (value === undefined || value === null || value === "") return null
  const display = typeof value === "number" ? formatStat(value) : value
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{display}</dd>
    </div>
  )
}
