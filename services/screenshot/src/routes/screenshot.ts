import { Hono } from "hono"

import { env } from "../env.ts"
import { isAllowedReferer, verifyPat } from "../lib/auth.ts"
import {
  renderScreenshot,
  type ImageFormat,
} from "../lib/playwright.ts"
import { getObject, objectKey, putObject } from "../lib/r2.ts"

const HEX_COLOR_RE = /^[0-9a-fA-F]{6}$/
const DEFAULT_BG = "0a0a0a"
const VALID_FORMATS = ["webp", "png", "jpeg"] as const

function contentTypeFor(format: ImageFormat): string {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`
}

function isValidFormat(value: string): value is ImageFormat {
  return (VALID_FORMATS as readonly string[]).includes(value)
}

export const screenshotRoute = new Hono()

screenshotRoute.get("/builds/:slug/screenshot", async (c) => {
  if (!isAllowedReferer(c)) {
    const auth = await verifyPat(c)
    if (!auth.ok) {
      return c.json({ error: auth.error }, auth.status)
    }
  }

  const slug = c.req.param("slug")
  const bg = c.req.query("bg") ?? DEFAULT_BG
  const format = c.req.query("format") ?? "webp"
  const refresh = c.req.query("refresh") === "true"

  if (!HEX_COLOR_RE.test(bg)) {
    return c.json({ error: "invalid_bg" }, 400)
  }
  if (!isValidFormat(format)) {
    return c.json({ error: "invalid_format" }, 400)
  }

  const key = objectKey(slug, bg, format)
  const contentType = contentTypeFor(format)
  // Images only change on build edit, which calls /invalidate to purge both
  // R2 and the CF edge cache. Until then there's nothing to refresh.
  const cacheControl = refresh
    ? "no-store"
    : "public, max-age=31536000, immutable"

  if (!refresh) {
    const cached = await getObject(key)
    if (cached) {
      return new Response(new Uint8Array(cached), {
        status: 200,
        headers: {
          "content-type": contentType,
          "cache-control": cacheControl,
          "x-screenshot-cache": "r2-hit",
        },
      })
    }
  }

  try {
    const image = await renderScreenshot({
      url: `${env.SCREENSHOT_BASE_URL}/builds/${slug}`,
      bgColor: bg,
      format,
    })
    await putObject(key, image, contentType)
    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": cacheControl,
        "x-screenshot-cache": refresh ? "bypass" : "miss",
      },
    })
  } catch (err) {
    console.error("screenshot render failed", err)
    return c.json({ error: "render_failed" }, 500)
  }
})
