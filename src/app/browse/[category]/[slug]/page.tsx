import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ThumbsUp, Eye } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Icons } from "@/components/icons";
// Server-only imports (uses Node.js fs via @wfcd/items)
import { getItemBySlug, getStaticItems } from "@/lib/warframe/items";
import { getPublicBuildsForItem } from "@/lib/db/index";
import {
  getCategoryConfig,
  getImageUrl,
  isValidCategory,
} from "@/lib/warframe";
import type {
  BrowseCategory,
  Warframe,
  Gun,
  Melee,
} from "@/lib/warframe/types";

// Generate static params for top items
export async function generateStaticParams() {
  const items = getStaticItems(50);
  return items.map(({ category, slug }) => ({
    category,
    slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;

  if (!isValidCategory(category)) {
    return { title: "Item Not Found | ARSENYX" };
  }

  const item = getItemBySlug(category as BrowseCategory, slug);

  if (!item) {
    return { title: "Item Not Found | ARSENYX" };
  }

  const categoryConfig = getCategoryConfig(category as BrowseCategory);

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
  };
}

interface ItemPageProps {
  params: Promise<{
    category: string;
    slug: string;
  }>;
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { category, slug } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const item = getItemBySlug(category as BrowseCategory, slug);

  if (!item) {
    notFound();
  }

  const categoryConfig = getCategoryConfig(category as BrowseCategory);
  const imageUrl = getImageUrl(item.imageName);

  // Type guards for specific item types
  const isWarframe = category === "warframes" || category === "necramechs";
  const isWeapon =
    category === "primary" || category === "secondary" || category === "melee";
  const isMelee = category === "melee";

  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-6 flex flex-col gap-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
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
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image */}
            <div className="shrink-0">
              <div className="relative size-48 md:w-64 md:h-64 bg-muted/30 rounded-xl flex items-center justify-center border">
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
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {item.name}
                  </h1>
                  {item.isPrime && (
                    <Badge className="bg-amber-500 text-white">Prime</Badge>
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
                <Button size="lg" className="gap-2" asChild>
                  <Link href={`/create?item=${slug}&category=${category}`}>
                    <Icons.plus className="h-4 w-4" />
                    Create Build
                  </Link>
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
                          1
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
                          1
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
                      <div key={ability.uniqueName} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="font-medium">{ability.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
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
  );
}

function CommunityBuildsSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-video rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

async function CommunityBuildsSection({
  itemUniqueName,
  itemName,
  category,
  slug,
}: {
  itemUniqueName: string;
  itemName: string;
  category: string;
  slug: string;
}) {
  const { builds, total } = await getPublicBuildsForItem(itemUniqueName, {
    limit: 6,
    sortBy: "votes",
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          Community Builds
          {total > 0 && (
            <span className="ml-2 text-lg font-normal text-muted-foreground">
              ({total})
            </span>
          )}
        </h2>
        {total > 6 && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/builds?category=${category}`}>View All</Link>
          </Button>
        )}
      </div>

      {builds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Icons.users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No builds yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Be the first to share a {itemName} build with the community!
            </p>
            <Button className="gap-2" asChild>
              <Link href={`/create?item=${slug}&category=${category}`}>
                <Icons.plus className="h-4 w-4" />
                Create Build
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {builds.map((build) => (
            <Link
              key={build.id}
              href={`/builds/${build.slug}`}
              className="block bg-card border rounded-lg overflow-hidden hover:border-primary transition-colors"
            >
              <div className="relative aspect-video bg-muted/20">
                <Image
                  src={getImageUrl(build.item.imageName ?? undefined)}
                  alt={build.item.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-2 flex flex-col gap-1">
                <h3 className="font-medium text-sm line-clamp-1">
                  {build.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  by {build.user.username || build.user.name || "Anonymous"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <ThumbsUp className="h-3 w-3" />
                    {build.voteCount}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" />
                    {build.viewCount}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function StatItem({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  if (value === undefined) return null;

  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
