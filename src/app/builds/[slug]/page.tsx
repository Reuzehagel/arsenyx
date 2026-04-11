import { ChevronRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { BuildContainer } from "@/components/build-editor/build-container"
import { BuildSocialActions } from "@/components/build/build-social-actions"
import { ShareButton } from "@/components/build/share-button"
import { TemplateButton } from "@/components/build/template-button"
import { ViewTracker } from "@/components/build/view-tracker"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { OrgBadge } from "@/components/org"
import { Skeleton } from "@/components/ui/skeleton"
import { getServerSession } from "@/lib/auth"
import { getCompatibleArcanesForItem } from "@/lib/builds/layout"
import { getBuildBySlug } from "@/lib/db/index"
import { isOrgMember } from "@/lib/db/organizations"
import { getCategoryConfig } from "@/lib/warframe"
import { isWarframeCategory } from "@/lib/warframe/categories"
import { getFullItem } from "@/lib/warframe/items"
import {
  getModsForItem,
  getAllHelminthAugmentMods,
} from "@/lib/warframe/mods"
import { slugify } from "@/lib/warframe/slugs"
import type { BrowseCategory } from "@/lib/warframe/types"

interface BuildPageProps {
  params: Promise<{
    slug: string
  }>
}

// Generate metadata for social sharing
export async function generateMetadata({
  params,
}: BuildPageProps): Promise<Metadata> {
  const { slug } = await params
  const build = await getBuildBySlug(slug)

  if (!build) {
    return {
      title: "Build Not Found | ARSENYX",
    }
  }

  const title = `${build.name} - ${build.item.name} Build | ARSENYX`
  const description =
    build.description ||
    `${build.item.name} build by ${
      build.user.username || build.user.name || "Anonymous"
    }`

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
  }
}

function BuildViewSkeleton() {
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

export default async function BuildPage({ params }: BuildPageProps) {
  const [{ slug }, session] = await Promise.all([params, getServerSession()])
  const viewerId = session?.user?.id

  // Fetch the build with visibility check
  const build = await getBuildBySlug(slug, viewerId)

  if (!build) {
    notFound()
  }

  // Get the category from the build's item
  const category = build.item.browseCategory as BrowseCategory

  // Fetch the full item data
  const fullItem = getFullItem(category, build.item.uniqueName)

  if (!fullItem) {
    notFound()
  }

  // Get compatible mods and arcanes
  const categoryConfig = getCategoryConfig(category)
  const compatibleMods = getModsForItem(fullItem)
  const compatibleArcanes = getCompatibleArcanesForItem(fullItem, category)

  // Check if the current user is the owner or an org member who can edit
  const isOwner = viewerId === build.userId
  const canEdit =
    isOwner ||
    (build.organization && viewerId
      ? await isOrgMember(build.organization.id, viewerId)
      : false)

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Build Info Banner */}
        <div className="bg-muted/30 border-b">
          <div className="container py-3">
            {/* Breadcrumbs */}
            <div className="text-muted-foreground mb-3 flex items-center text-sm">
              <Link
                href="/builds"
                className="hover:text-primary transition-colors"
              >
                Builds
              </Link>
              <ChevronRight className="mx-1 size-4" />
              <Link
                href={`/browse/${category}`}
                className="hover:text-primary capitalize transition-colors"
              >
                {category}
              </Link>
              <ChevronRight className="mx-1 size-4" />
              <Link
                href={`/browse/${category}/${slugify(build.item.name)}`}
                className="hover:text-primary transition-colors"
              >
                {build.item.name}
              </Link>
              <ChevronRight className="mx-1 size-4" />
              <span className="text-foreground max-w-[200px] truncate font-medium">
                {build.name}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">{build.name}</h1>
                {build.organization ? (
                  <span className="text-sm">
                    <OrgBadge
                      name={build.organization.name}
                      slug={build.organization.slug}
                    />
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    by{" "}
                    {build.user.username ? (
                      <Link
                        href={`/profile/${build.user.username}`}
                        className="hover:text-foreground transition-colors hover:underline"
                      >
                        {build.user.username}
                      </Link>
                    ) : (
                      build.user.name || "Anonymous"
                    )}
                  </span>
                )}
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
                <span className="text-muted-foreground text-sm">
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
            helminthAugmentMods={
              isWarframeCategory(category)
                ? getAllHelminthAugmentMods()
                : undefined
            }
            compatibleArcanes={compatibleArcanes}
            importedBuild={build.buildData}
            savedBuildId={build.id}
            readOnly={!canEdit}
            isOwner={canEdit}
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
              buildData: {
                formaCount:
                  (pb.buildData as { formaCount?: number })?.formaCount ?? 0,
              },
            }))}
            initialOrganizationSlug={build.organization?.slug}
            initialVisibility={build.visibility}
          />
        </Suspense>
      </main>
      <Footer />
      <ViewTracker buildId={build.id} />
    </div>
  )
}
