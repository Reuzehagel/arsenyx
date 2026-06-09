import { useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { proxyImage } from "@/lib/util/image-proxy"
import { getVideoEmbed } from "@/lib/util/video-embed"

/**
 * Renders user-authored markdown for build guides. Bare YouTube/Vimeo URLs
 * on their own line are upgraded to embedded iframes; inline links stay
 * regular anchors. Raw HTML in the source is escaped — no rehype-raw.
 *
 * `remark-breaks` turns a single newline into a line break (instead of GFM's
 * default soft-wrap-to-space). Build-guide authors write line-by-line and
 * expect Discord/chat-style breaks; the bare-GFM behaviour was a repeat source
 * of "why did my newline vanish" confusion.
 */
export function MarkdownBody({
  source,
  className,
}: {
  source: string
  className?: string
}) {
  const prepared = useMemo(() => isolateVideoLines(source), [source])
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  )
}

/**
 * Wraps lines that consist solely of a recognized video URL with blank
 * lines so markdown treats them as their own paragraph. Without this,
 * `Hi\nhttps://youtu.be/...\nTesting` would be one paragraph and the
 * embed check would miss it.
 */
function isolateVideoLines(source: string): string {
  const lines = source.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    const isVideo =
      /^https?:\/\/\S+$/.test(trimmed) && getVideoEmbed(trimmed) !== null
    if (isVideo) {
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("")
      out.push(trimmed)
      out.push("")
    } else {
      out.push(line)
    }
  }
  return out.join("\n")
}

// react-markdown hands us hast nodes; we only read these few fields. Typed
// locally so we don't depend on @types/hast just for one shape.
type MarkdownNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
}

function soloVideoHref(kids: MarkdownNode[]): string | null {
  if (kids.length !== 1) return null
  const only = kids[0]
  if (only.type !== "element" || only.tagName !== "a") return null
  const href = only.properties?.href
  return typeof href === "string" ? href : null
}

const components: Components = {
  p({ node, children, ...rest }) {
    const href = soloVideoHref(node?.children ?? [])
    const embed = href ? getVideoEmbed(href) : null
    if (embed) return <VideoEmbed {...embed} />
    return <p {...rest}>{children}</p>
  },
  img({ node: _node, src, ...rest }) {
    const { src: cleanSrc, width } = parseSizedSrc(src)
    // Drop plaintext-http images outright. The api proxy only fetches https
    // upstreams (validateExternalUrl), so an `http://` source would render as
    // a broken image anyway — and we don't want to silently upgrade it to
    // https since the host may not serve TLS. Protocol-relative `//host/x`
    // and relative/data URLs are fine: `proxyImage` handles them.
    if (typeof cleanSrc === "string" && /^http:\/\//i.test(cleanSrc))
      return null
    // Route every markdown image through CF Image Resizing so the visitor's
    // browser never fetches a third-party URL directly. Without this, a
    // malicious guide author can dox every visitor (IP + Referer = build
    // slug) by embedding `![x](https://attacker.com/p.png)`.
    const proxied = proxyImage(cleanSrc)
    return (
      <img
        {...rest}
        src={proxied ?? undefined}
        loading="lazy"
        referrerPolicy="no-referrer"
        style={width ? { width, maxWidth: "100%" } : undefined}
        className="my-2 h-auto max-w-full rounded-md border object-contain"
      />
    )
  },
}

/**
 * Parses a custom `url|<width>` suffix on image URLs. The width can be a
 * bare number (treated as px) or include a unit (`200px`, `50%`). Anything
 * else is left alone so real `|` characters in URLs still work.
 */
function parseSizedSrc(src: string | Blob | undefined): {
  src: string | undefined
  width: string | undefined
} {
  if (typeof src !== "string") return { src: undefined, width: undefined }
  // Match a trailing `|<size>` or `%7C<size>` (remark URL-encodes `|`).
  const m = src.match(/(?:\||%7C)(\d+)(px|%|%25)?$/i)
  if (!m) return { src, width: undefined }
  const unit = m[2]?.toLowerCase() === "%25" ? "%" : (m[2] ?? "px")
  return { src: src.slice(0, m.index), width: `${m[1]}${unit}` }
}

function VideoEmbed({
  src,
  title,
  aspect,
}: {
  src: string
  title: string
  aspect: "16/9" | "9/16"
}) {
  const portrait = aspect === "9/16"
  return (
    <div
      className="bg-muted relative my-3 w-full overflow-hidden rounded-lg border"
      style={{
        aspectRatio: portrait ? "9 / 16" : "16 / 9",
        maxWidth: portrait ? "min(100%, 320px)" : "min(100%, 560px)",
      }}
    >
      {/* oxlint-disable-next-line react/iframe-missing-sandbox -- trusted video provider; sandbox would break the player */}
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 size-full"
      />
    </div>
  )
}
