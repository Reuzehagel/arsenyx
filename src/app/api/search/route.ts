import { NextRequest, NextResponse } from "next/server"

import { searchItemsFromDb, prisma } from "@/lib/db/index"
import { searchLimiter, RateLimitError } from "@/lib/rate-limit"

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

  const [items, buildResults] = await Promise.all([
    // Items: use existing ILIKE search
    searchItemsFromDb(q, undefined, 5),
    // Builds: use tsvector search
    prisma.$queryRaw<
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
        i.name AS "itemName",
        COALESCE(u.username, u.name, 'Anonymous') AS author,
        b."voteCount"
      FROM builds b
      JOIN items i ON i.id = b."itemId"
      JOIN users u ON u.id = b."userId"
      WHERE b."searchVector" @@ plainto_tsquery('english', ${q})
        AND b.visibility = 'PUBLIC'
      ORDER BY ts_rank(b."searchVector", plainto_tsquery('english', ${q})) DESC
      LIMIT 5
    `,
  ])

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
