const SCREENSHOT_SERVICE_URL = process.env.SCREENSHOT_SERVICE_URL
const SCREENSHOT_SERVICE_SECRET = process.env.SCREENSHOT_SERVICE_SECRET
const INVALIDATE_TIMEOUT_MS = 5_000

export function invalidateBuildScreenshot(slug: string): void {
  if (!SCREENSHOT_SERVICE_URL || !SCREENSHOT_SERVICE_SECRET) return
  fetch(`${SCREENSHOT_SERVICE_URL}/invalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shared-secret": SCREENSHOT_SERVICE_SECRET,
    },
    body: JSON.stringify({ slug }),
    signal: AbortSignal.timeout(INVALIDATE_TIMEOUT_MS),
  }).catch((err) => {
    console.error("screenshot invalidation failed", err)
  })
}
