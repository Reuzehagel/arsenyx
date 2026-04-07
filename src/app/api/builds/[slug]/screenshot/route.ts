import { NextRequest, NextResponse } from "next/server"

import { validateApiKey } from "@/lib/api-keys"
import { getBuildBySlug } from "@/lib/db/index"
import { screenshotBuild } from "@/lib/screenshot"

export const runtime = "nodejs"

// Chromium needs more time and memory
export const maxDuration = 30

const HEX_COLOR_RE = /^[0-9a-fA-F]{6}$/

const DEFAULT_BG = "0a0a0a"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Validate API key
  const authHeader = request.headers.get("authorization")
  const authResult = await validateApiKey(authHeader, "image:generate")

  if (!authResult.success) {
    const { status, error, ...rest } = authResult.error
    return NextResponse.json(
      { error, ...("retryAfter" in rest ? { retryAfter: rest.retryAfter } : {}) },
      {
        status,
        headers:
          status === 429
            ? { "Retry-After": String((rest as { retryAfter: number }).retryAfter) }
            : {},
      },
    )
  }

  // 2. Validate query params
  const { searchParams } = request.nextUrl
  const bg = searchParams.get("bg") ?? DEFAULT_BG
  const refresh = searchParams.get("refresh") === "true"

  if (!HEX_COLOR_RE.test(bg)) {
    return NextResponse.json({ error: "Invalid bg color" }, { status: 400 })
  }

  // 3. Fetch build
  const { slug } = await params
  const build = await getBuildBySlug(slug)

  if (!build) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 })
  }

  if (build.visibility === "PRIVATE") {
    return NextResponse.json(
      { error: "Build not accessible" },
      { status: 403 },
    )
  }

  // 4. Generate screenshot
  const baseUrl =
    process.env.SCREENSHOT_BASE_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://www.arsenyx.com"
      : "http://localhost:3000")

  try {
    const png = await screenshotBuild({
      url: `${baseUrl}/builds/${slug}`,
      bgColor: bg,
    })

    const cacheControl = refresh
      ? "no-store"
      : "public, max-age=3600, stale-while-revalidate=86400"

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": cacheControl,
        "Content-Disposition": `inline; filename="${slug}-screenshot.png"`,
      },
    })
  } catch (err) {
    console.error("Screenshot generation failed:", err)
    return NextResponse.json(
      { error: "Image generation failed" },
      { status: 500 },
    )
  }
}
