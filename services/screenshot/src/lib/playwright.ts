import { chromium } from "playwright-core"
import sharp from "sharp"

export type ImageFormat = "webp" | "png" | "jpeg"

export interface RenderOptions {
  url: string
  bgColor: string
  format: ImageFormat
}

export async function renderScreenshot(opts: RenderOptions): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 1100 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    })

    await page.goto(opts.url, { waitUntil: "domcontentloaded" })

    const target = await page.waitForSelector("[data-screenshot-target]", {
      timeout: 10_000,
    })

    await page.waitForTimeout(2000)

    await page.evaluate((bg: string) => {
      const r = parseInt(bg.slice(0, 2), 16)
      const g = parseInt(bg.slice(2, 4), 16)
      const b = parseInt(bg.slice(4, 6), 16)
      const lift = 4
      const lifted = `rgb(${Math.min(255, r + lift)}, ${Math.min(255, g + lift)}, ${Math.min(255, b + lift)})`

      const root = document.documentElement
      root.style.setProperty("--background", `#${bg}`)
      root.style.setProperty("--card", `#${bg}`)
      root.style.setProperty("--muted", `#${bg}`)
      root.style.setProperty("--border", "transparent")
      document.body.style.backgroundColor = `#${bg}`

      const t = document.querySelector("[data-screenshot-target]")
      if (!t) return
      t.setAttribute("data-screenshot", "")
      t.querySelectorAll<HTMLElement>(":scope > .bg-card").forEach((el) => {
        el.style.backgroundColor = `#${bg}`
        el.style.borderColor = "transparent"
      })
      t.querySelectorAll<HTMLElement>(".border-dashed").forEach((el) => {
        el.style.backgroundColor = lifted
      })
      t.querySelectorAll<HTMLElement>(
        "[data-slot='tooltip-trigger'].bg-muted",
      ).forEach((el) => {
        el.style.backgroundColor = lifted
      })
      t.querySelectorAll<HTMLElement>(".border-dashed.size-10").forEach(
        (el) => {
          el.style.backgroundColor = lifted
        },
      )
    }, opts.bgColor)

    const png = await target.screenshot({ type: "png" })
    if (opts.format === "png") return Buffer.from(png)
    return sharp(png)[opts.format]({ quality: 95 }).toBuffer()
  } finally {
    await browser.close()
  }
}
