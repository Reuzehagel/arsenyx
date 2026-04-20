import { env } from "../env.ts"

export async function purgeCfUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) return
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CF_API_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    console.error("CF purge failed:", res.status, body)
  }
}

// CF free plan purges by exact URL only — no prefix support. We purge the
// default-bg variants; non-default bg requests TTL out within 1 hour.
export function buildScreenshotUrls(slug: string): string[] {
  const base = `${env.PUBLIC_BASE_URL}/builds/${slug}/screenshot`
  return [
    base,
    `${base}?format=png`,
    `${base}?format=webp`,
    `${base}?format=jpeg`,
  ]
}
