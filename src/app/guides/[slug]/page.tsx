import { Pencil, Share2, Copy } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Footer } from "@/components/footer"
import { GuideBreadcrumbs } from "@/components/guides/guide-breadcrumbs"
import { GuideHeader } from "@/components/guides/guide-header"
import { GuideReader } from "@/components/guides/guide-reader"
import { RelatedGuides } from "@/components/guides/related-guides"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import {
  getGuideBySlug,
  getRelatedGuides,
  getPublishedGuides,
  GUIDE_CATEGORY_INFO,
} from "@/lib/guides"

// Generate static params for all published guides
export async function generateStaticParams() {
  const guides = getPublishedGuides()
  return guides.map((guide) => ({
    slug: guide.slug,
  }))
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) {
    return {
      title: "Guide Not Found | ARSENYX",
    }
  }

  const categoryLabel = GUIDE_CATEGORY_INFO[guide.category].label

  return {
    title: `${guide.title} | ARSENYX Guides`,
    description: guide.summary,
    keywords: [categoryLabel, ...guide.tags],
    openGraph: {
      title: guide.title,
      description: guide.summary,
      type: "article",
      publishedTime: guide.createdAt,
      modifiedTime: guide.updatedAt,
      authors: [guide.author.name],
      tags: guide.tags,
    },
  }
}

// ISR: Revalidate every hour
export const revalidate = 3600

interface GuidePageProps {
  params: Promise<{ slug: string }>
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) {
    notFound()
  }

  const relatedGuides = getRelatedGuides(guide.id)
  const categoryInfo = GUIDE_CATEGORY_INFO[guide.category]

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          {/* Main Content */}
          <div className="mx-auto max-w-3xl">
            {/* Breadcrumbs */}
            <GuideBreadcrumbs
              items={[
                { label: "Guides", href: "/guides" },
                {
                  label: categoryInfo.label,
                  href: `/guides?category=${guide.category}`,
                },
                { label: guide.title },
              ]}
            />

            {/* Actions (dev mode only for now) */}
            {process.env.NODE_ENV === "development" && (
              <div className="mb-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/guides/${slug}/edit`} />}
                  nativeButton={false}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button variant="outline" size="icon" title="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Guide Header */}
            <GuideHeader guide={guide} />

            {/* Guide Content */}
            <article>
              <GuideReader content={guide.content} />
            </article>

            {/* Related Guides */}
            <Suspense fallback={null}>
              <RelatedGuides guides={relatedGuides} />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
