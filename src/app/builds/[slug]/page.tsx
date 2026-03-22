import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BuildContainer } from "@/components/build-editor/build-container";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerSession } from "@/lib/auth";
import { getBuildBySlug } from "@/lib/db/index";
import { getFullItem } from "@/lib/warframe/items";
import { getModsForItem, getArcanesForSlot } from "@/lib/warframe/mods";
import { getCategoryConfig } from "@/lib/warframe";
import type { BrowseCategory, Arcane } from "@/lib/warframe/types";
import { BuildSocialActions } from "@/components/build/build-social-actions";
import { slugify } from "@/lib/warframe/slugs";
import { ViewTracker } from "@/components/build/view-tracker";
import { TemplateButton } from "@/components/build/template-button";
import { ShareButton } from "@/components/build/share-button";


interface BuildPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Generate metadata for social sharing
export async function generateMetadata({
  params,
}: BuildPageProps): Promise<Metadata> {
  const { slug } = await params;
  const build = await getBuildBySlug(slug);

  if (!build) {
    return {
      title: "Build Not Found | ARSENYX",
    };
  }

  const title = `${build.name} - ${build.item.name} Build | ARSENYX`;
  const description =
    build.description ||
    `${build.item.name} build by ${
      build.user.username || build.user.name || "Anonymous"
    }`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function BuildViewSkeleton() {
  return (
    <div className="container py-6 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left sidebar skeleton */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        {/* Center mod grid skeleton */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
        {/* Right panel skeleton */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

export default async function BuildPage({ params }: BuildPageProps) {
  const [{ slug }, session] = await Promise.all([
    params,
    getServerSession(),
  ]);
  const viewerId = session?.user?.id;

  // Fetch the build with visibility check
  const build = await getBuildBySlug(slug, viewerId);

  if (!build) {
    notFound();
  }

  // Get the category from the build's item
  const category = build.item.browseCategory as BrowseCategory;

  // Fetch the full item data
  const fullItem = getFullItem(category, build.item.uniqueName);

  if (!fullItem) {
    notFound();
  }

  // Get compatible mods and arcanes
  const categoryConfig = getCategoryConfig(category);
  const compatibleMods = getModsForItem(fullItem);
  const isWarframeCategory =
    category === "warframes" || category === "necramechs";

  let compatibleArcanes: Arcane[] = [];
  if (isWarframeCategory) {
    compatibleArcanes = getArcanesForSlot("warframe");
  } else if (category === "primary") {
    compatibleArcanes = getArcanesForSlot("primary");
  } else if (category === "secondary") {
    compatibleArcanes = getArcanesForSlot("secondary");
  } else if (category === "melee") {
    compatibleArcanes = getArcanesForSlot("melee");
  }

  // Check if the current user is the owner
  const isOwner = viewerId === build.userId;

  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Build Info Banner */}
        <div className="border-b bg-muted/30">
          <div className="container py-3">
            {/* Breadcrumbs */}
            <div className="flex items-center text-sm text-muted-foreground mb-3">
              <Link
                href="/builds"
                className="hover:text-primary transition-colors"
              >
                Builds
              </Link>
              <ChevronRight className="h-4 w-4 mx-1" />
              <Link
                href={`/browse/${category}`}
                className="hover:text-primary transition-colors capitalize"
              >
                {category}
              </Link>
              <ChevronRight className="h-4 w-4 mx-1" />
              <Link
                href={`/browse/${category}/${slugify(build.item.name)}`}
                className="hover:text-primary transition-colors"
              >
                {build.item.name}
              </Link>
              <ChevronRight className="h-4 w-4 mx-1" />
              <span className="text-foreground font-medium truncate max-w-[200px]">
                {build.name}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">{build.name}</h1>
                <span className="text-sm text-muted-foreground">
                  by {build.user.username || build.user.name || "Anonymous"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BuildSocialActions
                  buildId={build.id}
                  voteCount={build.voteCount}
                  favoriteCount={build.favoriteCount}
                  viewCount={build.viewCount}
                />
                <TemplateButton
                  buildSlug={build.slug}
                  itemName={build.item.name}
                  category={category}
                />
                <ShareButton
                  buildName={build.name}
                  itemName={build.item.name}
                  buildSlug={build.slug}
                />
                <span className="text-sm text-muted-foreground">
                  Updated {new Date(build.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

<Suspense fallback={<BuildViewSkeleton />}>
          <BuildContainer
            item={fullItem}
            category={category}
            categoryLabel={categoryConfig?.label ?? "Item"}
            compatibleMods={compatibleMods}
            compatibleArcanes={compatibleArcanes}
            importedBuild={build.buildData}
            savedBuildId={build.id}
            readOnly={!isOwner}
            isOwner={isOwner}
            initialGuide={{
              summary: build.buildGuide?.summary,
              description: build.buildGuide?.description,
              updatedAt: build.buildGuide?.updatedAt,
            }}
            initialPartnerBuilds={build.partnerBuilds.map((pb) => ({
              id: pb.id,
              slug: pb.slug,
              name: pb.name,
              item: pb.item,
              buildData: pb.buildData as { formaCount: number },
            }))}
          />
        </Suspense>
      </main>
      <Footer />
      <ViewTracker buildId={build.id} />
    </div>
  );
}
