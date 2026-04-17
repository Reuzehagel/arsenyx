import "server-only"

import sharp from "sharp"

export type ImageFormat = "webp" | "png" | "jpeg"

export interface ScreenshotOptions {
  /** Full URL of the build page to screenshot */
  url: string
  /** Hex background color without '#' (e.g. "111111") */
  bgColor: string
  /** Output format (default: webp) */
  format?: ImageFormat
}

export async function screenshotBuild(
  options: ScreenshotOptions,
): Promise<Buffer> {
  const { chromium: playwright } = await import("playwright-core")

  const CHROMIUM_PACK_URL =
    "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar"

  let browser
  if (process.env.NODE_ENV === "production") {
    const chromium = await import("@sparticuz/chromium-min")
    browser = await playwright.launch({
      args: chromium.default.args,
      executablePath: await chromium.default.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    })
  } else {
    if (!process.env.CHROME_PATH) {
      throw new Error("CHROME_PATH env var is required for local development")
    }
    browser = await playwright.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
    })
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 1100 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    })

    await page.goto(options.url, { waitUntil: "domcontentloaded" })

    const target = await page.waitForSelector("[data-screenshot-target]", {
      timeout: 10000,
    })

    // Wait for React hydration — stats are computed client-side
    await page.waitForTimeout(2000)

    const color = `#${options.bgColor}`
    await page.evaluate((bgColor: string) => {
      const r = parseInt(bgColor.slice(1, 3), 16)
      const g = parseInt(bgColor.slice(3, 5), 16)
      const b = parseInt(bgColor.slice(5, 7), 16)
      const lift = 4
      const liftedColor = `rgb(${Math.min(255, r + lift)}, ${Math.min(255, g + lift)}, ${Math.min(255, b + lift)})`

      const root = document.documentElement
      root.style.setProperty("--background", bgColor)
      root.style.setProperty("--card", bgColor)
      root.style.setProperty("--muted", bgColor)
      root.style.setProperty("--border", "transparent")
      document.body.style.backgroundColor = bgColor

      const target = document.querySelector("[data-screenshot-target]")
      if (!target) return

      // Enable screenshot-specific rendering (e.g. riven stats on compact cards)
      target.setAttribute("data-screenshot", "")

      target.querySelectorAll(":scope > .bg-card").forEach((el) => {
        ;(el as HTMLElement).style.backgroundColor = bgColor
        ;(el as HTMLElement).style.borderColor = "transparent"
      })

      target.querySelectorAll(".border-dashed").forEach((el) => {
        ;(el as HTMLElement).style.backgroundColor = liftedColor
      })

      target.querySelectorAll("[data-slot='tooltip-trigger'].bg-muted").forEach((el) => {
        ;(el as HTMLElement).style.backgroundColor = liftedColor
      })

      target.querySelectorAll(".border-dashed.size-10").forEach((el) => {
        ;(el as HTMLElement).style.backgroundColor = liftedColor
      })
    }, color)

    const png = await target!.screenshot({ type: "png" })
    const format = options.format ?? "webp"

    if (format === "png") return Buffer.from(png)

    return sharp(png)[format]({ quality: 95 }).toBuffer()
  } finally {
    await browser.close()
  }
}
