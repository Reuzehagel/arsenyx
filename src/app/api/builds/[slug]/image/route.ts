import { NextRequest, NextResponse } from "next/server"

import { getBuildBySlug } from "@/lib/db/index"
import { renderBuildImage } from "@/lib/image/render"
import { imageLimiter, RateLimitError } from "@/lib/rate-limit"
import { getImageUrl } from "@/lib/warframe/images"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous"
    await imageLimiter.check(10, ip)
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    throw e
  }

  const { slug } = await params

  // Fetch build (no viewerId = public/unlisted only)
  const build = await getBuildBySlug(slug)
  if (!build) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 })
  }

  const authorName = build.user.username || build.user.name || "Anonymous"

  const itemImageUrl = build.item.imageName
    ? getImageUrl(build.item.imageName)
    : undefined

  try {
    const png = await renderBuildImage({
      buildState: build.buildData,
      buildName: build.name,
      itemName: build.item.name,
      authorName,
      itemImageUrl,
    })

    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "Content-Disposition": `inline; filename="${slug}.png"`,
      },
    })
  } catch (err) {
    console.error("Image generation failed:", err)
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 },
    )
  }
}
