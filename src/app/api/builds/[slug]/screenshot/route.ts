import { NextRequest, NextResponse } from "next/server"

import { requireApiKey } from "@/lib/auth/api-keys"
import { getBuildBySlug } from "@/lib/db/index"
import { screenshotLimiter, RateLimitError } from "@/lib/rate-limit"
import { screenshotBuild } from "@/lib/screenshot"

export const runtime = "nodejs"
export const maxDuration = 30

const HEX_COLOR_RE = /^[0-9a-fA-F]{6}$/
const DEFAULT_BG = "0a0a0a"

const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_SCREENSHOT_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean)

function isAllowedReferer(request: NextRequest): boolean {
  if (ALLOWED_ORIGINS.length === 0) return false
  const referer = request.headers.get("referer")
  if (!referer) return false
  try {
    const origin = new URL(referer).origin.toLowerCase()
    return ALLOWED_ORIGINS.includes(origin)
  } catch {
    return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Auth: allowed referer OR API key
  const refererAllowed = isAllowedReferer(request)

  if (!refererAllowed) {
    const authResult = await requireApiKey(request, "image:generate")

    if (!authResult.success) {
      const { status, code, message } = authResult.error
      return NextResponse.json(
        { error: code, message },
        {
          status,
          headers:
            status === 429
              ? { "Retry-After": "3600" }
              : {},
        },
      )
    }
  } else {
    // Rate limit referer-based access by origin
    const referer = request.headers.get("referer")!
    const origin = new URL(referer).origin
    try {
      await screenshotLimiter.check(100, `referer:${origin}`)
    } catch (e) {
      if (e instanceof RateLimitError) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "Retry-After": "3600" } },
        )
      }
      throw e
    }
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
