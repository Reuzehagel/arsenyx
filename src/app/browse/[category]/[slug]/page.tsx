import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { BuildCardLink } from "@/components/build/build-card-link"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Icons } from "@/components/icons"
import { OrgBadge } from "@/components/org"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getPublicBuildsForItem } from "@/lib/db/index"
import { getCategoryConfig, getImageUrl, isValidCategory } from "@/lib/warframe"
// Server-only imports (uses Node.js fs via @wfcd/items)
import { getItemBySlug, getStaticItems } from "@/lib/warframe/items"
import type { BrowseCategory, Warframe, Gun, Melee } from "@/lib/warframe/types"

// Generate static params for top items
export async function generateStaticParams() {
  const items = getStaticItems(50)
  return items.map(({ category, slug }) => ({
    category,
    slug,
  }))
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}): Promise<Metadata> {
  const { category, slug } = await params

  if (!isValidCategory(category)) {
    return { title: "Item Not Found | ARSENYX" }
  }

  const item = getItemBySlug(category as BrowseCategory, slug)

  if (!item) {
    return { title: "Item Not Found | ARSENYX" }
  }

  const categoryConfig = getCategoryConfig(category as BrowseCategory)

  return {
    title: `${item.name} | ARSENYX`,
    description:
      item.description ||
      `View ${item.name} stats, builds, and create your own ${categoryConfig?.label} build.`,
    openGraph: {
      title: `${item.name} | ARSENYX`,
      description:
        item.description ||
        `View ${item.name} stats, builds, and create your own build.`,
      images: item.imageName
        ? [{ url: getImageUrl(item.imageName), width: 256, height: 256 }]
        : undefined,
    },
  }
}

interface ItemPageProps {
  params: Promise<{
    category: string
    slug: string
  }>
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { category, slug } = await params

  if (!isValidCategory(category)) {
    notFound()
  }

  const item = getItemBySlug(category as BrowseCategory, slug)

  if (!item) {
    notFound()
  }

  const categoryConfig = getCategoryConfig(category as BrowseCategory)
  const imageUrl = getImageUrl(item.imageName)

  // Type guards for specific item types
  const isWarframe = category === "warframes" || category === "necramechs"
  const isWeapon =
    category === "primary" || category === "secondary" || category === "melee"
  const isMelee = category === "melee"

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-8 py-6">
          {/* Breadcrumb */}
          <nav className="text-muted-foreground flex items-center gap-2 text-sm">
            <Link
              href="/browse"
              className="hover:text-foreground transition-colors"
            >
              Browse
            </Link>
            <span>/</span>
            <Link
              href={`/browse?category=${category}`}
              className="hover:text-foreground transition-colors"
            >
              {categoryConfig?.labelPlural}
            </Link>
            <span>/</span>
            <span className="text-foreground">{item.name}</span>
          </nav>

          {/* Item Header */}
          <div className="flex flex-col gap-8 md:flex-row">
            {/* Image */}
            <div className="shrink-0">
              <div className="bg-muted/30 relative flex size-48 items-center justify-center rounded-xl border md:h-64 md:w-64">
                <Image
                  src={imageUrl}
                  alt={item.name}
                  width={256}
                  height={256}
                  className="object-contain"
                  unoptimized
                  priority
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {item.name}
                  </h1>
                  {item.isPrime && (
                    <Badge className="bg-wf-prime text-white">Prime</Badge>
                  )}
                  {item.vaulted && <Badge variant="outline">Vaulted</Badge>}
                </div>
                {item.description && (
                  <p className="text-muted-foreground max-w-2xl">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4 text-sm">
                {item.masteryReq !== undefined && item.masteryReq > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Mastery:</span>
                    <span className="font-medium">MR {item.masteryReq}</span>
                  </div>
                )}
                {(item as { type?: string }).type && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium">
                      {(item as { type?: string }).type}
                    </span>
                  </div>
                )}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  size="lg"
                  className="gap-2"
                  render={
                    <Link href={`/create?item=${slug}&category=${category}`} />
                  }
                  nativeButton={false}
                >
                  <Icons.plus data-icon="inline-start" />
                  Create Build
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Stats Section */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Warframe Stats */}
            {isWarframe && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Base Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <StatItem
                      label="Health"
                      value={(item as Warframe).health}
                    />
                    <StatItem
                      label="Shield"
                      value={(item as Warframe).shield}
                    />
                    <StatItem label="Armor" value={(item as Warframe).armor} />
                    <StatItem label="Energy" value={(item as Warframe).power} />
                    {(item as Warframe).sprintSpeed && (
                      <StatItem
                        label="Sprint"
                        value={(item as Warframe).sprintSpeed}
                      />
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Weapon Stats */}
            {isWeapon && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Weapon Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {(item as Gun).totalDamage && (
                      <StatItem
                        label="Damage"
                        value={(item as Gun).totalDamage}
                      />
                    )}
                    {(item as Gun).criticalChance && (
                      <StatItem
                        label="Crit Chance"
                        value={`${((item as Gun).criticalChance! * 100).toFixed(
                          1,
                        )}%`}
                      />
                    )}
                    {(item as Gun).criticalMultiplier && (
                      <StatItem
                        label="Crit Multi"
                        value={`${(item as Gun).criticalMultiplier}x`}
                      />
                    )}
                    {(item as Gun).procChance && (
                      <StatItem
                        label="Status"
                        value={`${((item as Gun).procChance! * 100).toFixed(
                          1,
                        )}%`}
                      />
                    )}
                    {(item as Gun).fireRate && (
                      <StatItem
                        label="Fire Rate"
                        value={parseFloat((item as Gun).fireRate!.toFixed(3))}
                      />
                    )}
                    {(item as Gun).magazineSize && (
                      <StatItem
                        label="Magazine"
                        value={(item as Gun).magazineSize}
                      />
                    )}
                    {(item as Gun).reloadTime && (
                      <StatItem
                        label="Reload"
                        value={`${parseFloat((item as Gun).reloadTime!.toFixed(2))}s`}
                      />
                    )}
                    {isMelee && (item as Melee).range && (
                      <StatItem label="Range" value={(item as Melee).range} />
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Abilities (for Warframes) */}
            {isWarframe && (item as Warframe).abilities && (
              <Card className="md:col-span-2 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Abilities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(item as Warframe).abilities?.map((ability, index) => (
                      <div
                        key={ability.uniqueName}
                        className="flex flex-col gap-1"
                      >
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

          <Separator />

          {/* Community Builds Section */}
          <Suspense fallback={<CommunityBuildsSkeleton />}>
            <CommunityBuildsSection
              itemUniqueName={item.uniqueName}
              itemName={item.name}
              category={category}
              slug={slug}
            />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function CommunityBuildsSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-video rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  )
}

async function CommunityBuildsSection({
  itemUniqueName,
  itemName,
  category,
  slug,
}: {
  itemUniqueName: string
  itemName: string
  category: string
  slug: string
}) {
  const { builds, total } = await getPublicBuildsForItem(itemUniqueName, {
    limit: 6,
    sortBy: "votes",
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          Community Builds
          {total > 0 && (
            <span className="text-muted-foreground ml-2 text-lg font-normal">
              ({total})
            </span>
          )}
        </h2>
        {total > 6 && (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/builds?category=${category}`} />}
            nativeButton={false}
          >
            View All
          </Button>
        )}
      </div>

      {builds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted mb-4 rounded-full p-4">
              <Icons.users className="text-muted-foreground h-8 w-8" />
            </div>
            <h3 className="mb-1 font-semibold">No builds yet</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Be the first to share a {itemName} build with the community!
            </p>
            <Button
              className="gap-2"
              render={
                <Link href={`/create?item=${slug}&category=${category}`} />
              }
              nativeButton={false}
            >
              <Icons.plus data-icon="inline-start" />
              Create Build
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {builds.map((build) => (
            <BuildCardLink
              key={build.id}
              slug={build.slug}
              name={build.name}
              itemName={build.item.name}
              itemImageName={build.item.imageName}
              voteCount={build.voteCount}
              viewCount={build.viewCount}
              subtitle={
                build.organization ? (
                  <p className="line-clamp-1 text-xs">
                    <OrgBadge
                      name={build.organization.name}
                      slug={build.organization.slug}
                      linked={false}
                    />
                  </p>
                ) : (
                  <p className="text-muted-foreground line-clamp-1 text-xs">
                    by {build.user.displayUsername || build.user.username || build.user.name || "Anonymous"}
                  </p>
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}

function StatItem({
  label,
  value,
}: {
  label: string
  value: string | number | undefined
}) {
  if (value === undefined) return null

  const display =
    typeof value === "number" && !Number.isInteger(value)
      ? parseFloat(value.toFixed(2))
      : value

  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{display}</dd>
    </div>
  )
}
