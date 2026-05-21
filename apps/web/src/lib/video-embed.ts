/**
 * Maps a URL to a safe video embed. Strict allowlist — only well-known
 * video hosts whose embed iframes are sandboxed by the provider.
 *
 * Used by markdown rendering to auto-embed bare YouTube/Vimeo links that
 * appear on their own line. Inline links inside prose are left alone.
 */
export type VideoEmbed = {
  src: string
  title: string
  aspect: "16/9" | "9/16"
}

export function getVideoEmbed(rawUrl: string): VideoEmbed | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null

  const host = url.hostname.replace(/^www\./, "")

  // YouTube — youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID,
  // youtube.com/embed/ID, m.youtube.com/watch?v=ID
  const start = parseTimecode(
    url.searchParams.get("t") ?? url.searchParams.get("start") ?? "",
  )
  if (host === "youtu.be") {
    return ytEmbed(url.pathname.slice(1).split("/")[0], start)
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") return ytEmbed(url.searchParams.get("v"), start)
    const shorts = url.pathname.match(/^\/shorts\/([^/]+)/)
    if (shorts) return ytEmbed(shorts[1], start, "9/16")
    const embed = url.pathname.match(/^\/embed\/([^/]+)/)
    if (embed) return ytEmbed(embed[1], start)
  }

  // Vimeo — vimeo.com/ID or vimeo.com/ID/HASH (unlisted videos)
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?/)
    if (m) {
      const [, id, hash] = m
      const src = hash
        ? `https://player.vimeo.com/video/${id}?h=${hash}`
        : `https://player.vimeo.com/video/${id}`
      return { src, title: "Vimeo video", aspect: "16/9" }
    }
  }

  return null
}

function ytEmbed(
  id: string | null,
  start: number | null,
  aspect: VideoEmbed["aspect"] = "16/9",
): VideoEmbed | null {
  if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null
  const qs = start ? `?start=${start}` : ""
  return {
    src: `https://www.youtube-nocookie.com/embed/${id}${qs}`,
    title: "YouTube video",
    aspect,
  }
}

function parseTimecode(t: string): number | null {
  if (!t) return null
  if (/^\d+$/.test(t)) return Number(t) || null
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!m) return null
  const [, h, mm, s] = m
  const total = Number(h ?? 0) * 3600 + Number(mm ?? 0) * 60 + Number(s ?? 0)
  return total || null
}
