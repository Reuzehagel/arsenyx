import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BuildContainer } from "@/components/build-editor/build-container";
import { Skeleton } from "@/components/ui/skeleton";
// Server-only imports
import { getItemBySlug, getFullItem } from "@/lib/warframe/items";
import { getModsForCategory, getArcanesForSlot } from "@/lib/warframe/mods";
import { isValidCategory, getCategoryConfig } from "@/lib/warframe";
import { decodeBuild } from "@/lib/build-codec";
import type { BrowseCategory } from "@/lib/warframe/types";

export const metadata: Metadata = {
  title: "Build Editor | ARSENIX",
  description:
    "Create and share Warframe builds with an intuitive keyboard-first editor.",
};

interface CreatePageProps {
  searchParams: Promise<{
    item?: string;
    category?: string;
    build?: string;
  }>;
}

function BuildEditorSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left sidebar skeleton */}
        <div className="lg:col-span-3 space-y-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        {/* Center mod grid skeleton */}
        <div className="lg:col-span-6 space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
        {/* Right panel skeleton */}
        <div className="lg:col-span-3 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const params = await searchParams;

  // Check for imported build
  if (params.build) {
    const decodedBuild = decodeBuild(decodeURIComponent(params.build));

    if (
      decodedBuild &&
      decodedBuild.itemUniqueName &&
      decodedBuild.itemCategory
    ) {
      // Load the full item data for the build
      const category = decodedBuild.itemCategory as BrowseCategory;
      const fullItem = getFullItem(category, decodedBuild.itemUniqueName);

      if (fullItem) {
        const categoryConfig = getCategoryConfig(category);
        const compatibleMods = getModsForCategory(category);
        // Fetch arcanes for warframes/necramechs
        const isWarframeCategory = category === "warframes" || category === "necramechs";
        const compatibleArcanes = isWarframeCategory ? getArcanesForSlot("warframe") : [];

        return (
          <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              <Suspense fallback={<BuildEditorSkeleton />}>
                <BuildContainer
                  item={fullItem}
                  category={category}
                  categoryLabel={categoryConfig?.label ?? "Item"}
                  compatibleMods={compatibleMods}
                  compatibleArcanes={compatibleArcanes}
                  importedBuild={decodedBuild}
                />
              </Suspense>
            </main>
            <Footer />
          </div>
        );
      }
    }
  }

  // Check for item + category params
  if (params.item && params.category) {
    if (!isValidCategory(params.category)) {
      notFound();
    }

    const category = params.category as BrowseCategory;
    const item = getItemBySlug(category, params.item);

    if (!item) {
      notFound();
    }

    const fullItem = getFullItem(category, item.uniqueName);
    const categoryConfig = getCategoryConfig(category);
    const compatibleMods = getModsForCategory(category);
    // Fetch arcanes for warframes/necramechs
    const isWarframeCategory = category === "warframes" || category === "necramechs";
    const compatibleArcanes = isWarframeCategory ? getArcanesForSlot("warframe") : [];

    return (
      <div className="relative min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Suspense fallback={<BuildEditorSkeleton />}>
            <BuildContainer
              item={fullItem ?? item}
              category={category}
              categoryLabel={categoryConfig?.label ?? "Item"}
              compatibleMods={compatibleMods}
              compatibleArcanes={compatibleArcanes}
            />
          </Suspense>
        </main>
        <Footer />
      </div>
    );
  }

  // No item specified - show item picker
  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-6">
          <div className="text-center space-y-4 py-16">
            <h1 className="text-3xl font-bold">Build Editor</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Select an item from the{" "}
              <Link
                href="/browse"
                className="text-primary underline underline-offset-4"
              >
                browse page
              </Link>{" "}
              to start creating a build.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
