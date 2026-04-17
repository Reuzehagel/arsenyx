import type { Metadata } from "next"
import { Suspense } from "react"

import { BrowseContainer } from "@/components/browse/browse-container"
import { BrowseKeyboardHandler } from "@/components/browse/keyboard-handler"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { getDefaultCategory, isValidCategory } from "@/lib/warframe"
// Server-only imports (uses Node.js fs via @wfcd/items)
import { getItemsByCategory } from "@/lib/warframe/items"
import type { BrowseCategory } from "@/lib/warframe/types"

export const metadata: Metadata = {
  title: "Browse Items | ARSENYX",
  description:
    "Browse Warframes, weapons, companions, and more. Find the perfect equipment for your next build.",
}

// ISR: Revalidate every 24 hours
export const revalidate = 86400

interface BrowsePageProps {
  searchParams: Promise<{
    category?: string
    q?: string
  }>
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams

  // Parse search params - only category needs server-side handling
  const category: BrowseCategory = isValidCategory(params.category ?? "")
    ? (params.category as BrowseCategory)
    : getDefaultCategory()

  const query = params.q ?? ""

  // Fetch ALL items for the category (filtering happens client-side for speed)
  const allItems = getItemsByCategory(category)

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      {/* Keyboard navigation handler */}
      <Suspense>
        <BrowseKeyboardHandler />
      </Suspense>
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          {/* Page Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Browse Items</h1>
            <p className="text-muted-foreground">
              Find and explore Warframes, weapons, and companions for your
              builds.
            </p>
          </div>

          {/* Client-side browse container with instant filtering */}
          <Suspense>
            <BrowseContainer
              initialItems={allItems}
              initialCategory={category}
              initialQuery={query}
            />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
