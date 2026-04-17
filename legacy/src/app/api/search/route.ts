import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { searchLimiter, RateLimitError } from "@/lib/rate-limit"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"
import { getItemsByCategory } from "@/lib/warframe/items"
import type { BrowseItem } from "@/lib/warframe/types"

function searchItems(query: string, limit: number): BrowseItem[] {
  const lowerQ = query.toLowerCase()
  const seen = new Set<string>()
  const results: BrowseItem[] = []
  for (const cat of BROWSE_CATEGORIES) {
    if (results.length >= limit) break
    for (const item of getItemsByCategory(cat.id)) {
      if (results.length >= limit) break
      if (seen.has(item.uniqueName)) continue
      if (item.name.toLowerCase().includes(lowerQ)) {
        seen.add(item.uniqueName)
        results.push(item)
      }
    }
  }
  return results
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous"
    await searchLimiter.check(30, ip)
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
  }

  const q = request.nextUrl.searchParams.get("q")?.trim()

  if (!q || q.length < 2 || q.length > 100) {
    return NextResponse.json({ items: [], builds: [] })
  }

  const items = searchItems(q, 5)

  const buildResults = await prisma.$queryRaw<
    {
      slug: string
      name: string
      itemName: string
      author: string
      voteCount: number
    }[]
  >`
    SELECT
      b.slug,
      b.name,
      b."itemName",
      COALESCE(u.username, u.name, 'Anonymous') AS author,
      b."voteCount"
    FROM builds b
    JOIN users u ON u.id = b."userId"
    WHERE b."searchVector" @@ plainto_tsquery('english', ${q})
      AND b.visibility = 'PUBLIC'
    ORDER BY ts_rank(b."searchVector", plainto_tsquery('english', ${q})) DESC
    LIMIT 5
  `

  return NextResponse.json({
    items: items.map((item) => ({
      uniqueName: item.uniqueName,
      name: item.name,
      imageName: item.imageName,
      browseCategory: item.category,
    })),
    builds: buildResults,
  })
}
