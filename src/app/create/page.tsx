import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { BuildContainer } from "@/components/build-editor/build-container"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Skeleton } from "@/components/ui/skeleton"
import { decodeBuild } from "@/lib/build-codec"
import { getCompatibleArcanesForItem } from "@/lib/builds/layout"
import { isValidCategory, getCategoryConfig } from "@/lib/warframe"
import { isWarframeCategory } from "@/lib/warframe/categories"
// Server-only imports
import { getItemBySlug, getFullItem } from "@/lib/warframe/items"
import {
  getModsForItem,
  getAllHelminthAugmentMods,
} from "@/lib/warframe/mods"
import type { BrowseCategory } from "@/lib/warframe/types"

export const metadata: Metadata = {
  title: "Build Editor | ARSENYX",
  description:
    "Create and share Warframe builds with an intuitive keyboard-first editor.",
}

interface CreatePageProps {
  searchParams: Promise<{
    item?: string
    category?: string
    build?: string
    fork?: string
  }>
}

function BuildEditorSkeleton() {
  return (
    <div className="container flex flex-col gap-6 py-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left sidebar skeleton */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        {/* Center mod grid skeleton */}
        <div className="flex flex-col gap-4 lg:col-span-6">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </div>
        {/* Right panel skeleton */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  )
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const params = await searchParams

  // Check for imported build
  if (params.build) {
    const decodedBuild = decodeBuild(decodeURIComponent(params.build))

    if (
      decodedBuild &&
      decodedBuild.itemUniqueName &&
      decodedBuild.itemCategory
    ) {
      // Load the full item data for the build
      const category = decodedBuild.itemCategory as BrowseCategory
      const fullItem = getFullItem(category, decodedBuild.itemUniqueName)

      if (fullItem) {
        const categoryConfig = getCategoryConfig(category)
        const compatibleMods = getModsForItem(fullItem)
        const compatibleArcanes = getCompatibleArcanesForItem(
          fullItem,
          category,
        )

        return (
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
              <Suspense fallback={<BuildEditorSkeleton />}>
                <BuildContainer
                  item={fullItem}
                  category={category}
                  categoryLabel={categoryConfig?.label ?? "Item"}
                  compatibleMods={compatibleMods}
                  helminthAugmentMods={
                    isWarframeCategory(category)
                      ? getAllHelminthAugmentMods()
                      : undefined
                  }
                  compatibleArcanes={compatibleArcanes}
                  importedBuild={decodedBuild}
                />
              </Suspense>
            </main>
            <Footer />
          </div>
        )
      }
    }
  }

  // Check for fork (Use as Template) — copies only mod slots from source build
  if (params.fork && params.item && params.category) {
    if (!isValidCategory(params.category)) {
      notFound()
    }

    const category = params.category as BrowseCategory
    const item = getItemBySlug(category, params.item)

    if (!item) {
      notFound()
    }

    // Fetch the source build to copy mods from
    const { getBuildBySlug } = await import("@/lib/db/index")
    const sourceBuild = await getBuildBySlug(params.fork)

    const fullItem = getFullItem(category, item.uniqueName)
    const categoryConfig = getCategoryConfig(category)
    const compatibleMods = fullItem ? getModsForItem(fullItem) : []
    const compatibleArcanes = fullItem
      ? getCompatibleArcanesForItem(fullItem, category)
      : []

    // Extract only mod configuration from source build
    const importedBuild = sourceBuild
      ? {
          itemUniqueName: item.uniqueName,
          itemName: item.name,
          itemCategory: category,
          itemImageName: item.imageName,
          normalSlots: sourceBuild.buildData.normalSlots,
          auraSlots: sourceBuild.buildData.auraSlots,
          exilusSlot: sourceBuild.buildData.exilusSlot,
          hasReactor: sourceBuild.buildData.hasReactor,
          formaCount: sourceBuild.buildData.formaCount,
          helminthAbility: sourceBuild.buildData.helminthAbility,
          arcaneSlots: [],
          shardSlots: [],
          baseCapacity: sourceBuild.buildData.hasReactor ? 60 : 30,
          currentCapacity: 0, // Will be recalculated
        }
      : undefined

    return (
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Suspense fallback={<BuildEditorSkeleton />}>
            <BuildContainer
              item={fullItem ?? item}
              category={category}
              categoryLabel={categoryConfig?.label ?? "Item"}
              compatibleMods={compatibleMods}
              helminthAugmentMods={
                isWarframeCategory(category)
                  ? getAllHelminthAugmentMods()
                  : undefined
              }
              compatibleArcanes={compatibleArcanes}
              importedBuild={importedBuild}
            />
          </Suspense>
        </main>
        <Footer />
      </div>
    )
  }

  // Check for item + category params
  if (params.item && params.category) {
    if (!isValidCategory(params.category)) {
      notFound()
    }

    const category = params.category as BrowseCategory
    const item = getItemBySlug(category, params.item)

    if (!item) {
      notFound()
    }

    const fullItem = getFullItem(category, item.uniqueName)
    const categoryConfig = getCategoryConfig(category)
    const compatibleMods = fullItem ? getModsForItem(fullItem) : []
    const compatibleArcanes = fullItem
      ? getCompatibleArcanesForItem(fullItem, category)
      : []

    return (
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <Suspense fallback={<BuildEditorSkeleton />}>
            <BuildContainer
              item={fullItem ?? item}
              category={category}
              categoryLabel={categoryConfig?.label ?? "Item"}
              compatibleMods={compatibleMods}
              helminthAugmentMods={
                isWarframeCategory(category)
                  ? getAllHelminthAugmentMods()
                  : undefined
              }
              compatibleArcanes={compatibleArcanes}
            />
          </Suspense>
        </main>
        <Footer />
      </div>
    )
  }

  // No item specified - show lightweight picker guidance
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-6">
          <div className="flex flex-col gap-4 py-16 text-center">
            <h1 className="text-3xl font-bold">Build Editor</h1>
            <p className="text-muted-foreground mx-auto max-w-md">
              Pick an item from the{" "}
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
  )
}
