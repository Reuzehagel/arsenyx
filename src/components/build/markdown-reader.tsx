"use client"

import { Children, isValidElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

interface MarkdownReaderProps {
  content: string
}

type LinkElementProps = {
  children?: ReactNode
  href?: unknown
}

function getYouTubeEmbedUrl(href: string | undefined) {
  if (!href) {
    return null
  }

  try {
    const url = new URL(href)
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase()
    const pathParts = url.pathname.split("/").filter(Boolean)
    let videoId: string | null = null

    if (hostname === "youtu.be") {
      videoId = pathParts[0] ?? null
    } else if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtube-nocookie.com"
    ) {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v")
      } else if (
        pathParts[0] === "embed" ||
        pathParts[0] === "live" ||
        pathParts[0] === "shorts"
      ) {
        videoId = pathParts[1] ?? null
      }
    }

    if (!videoId || !/^[\w-]{6,}$/.test(videoId)) {
      return null
    }

    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`
  } catch {
    return null
  }
}

function getTextContent(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : "",
    )
    .join("")
    .trim()
}

function getStandaloneYouTubeEmbed(children: ReactNode) {
  const childNodes = Children.toArray(children).filter(
    (child) => typeof child !== "string" || child.trim(),
  )

  if (childNodes.length !== 1) {
    return null
  }

  const child = childNodes[0]
  if (!isValidElement<LinkElementProps>(child)) {
    return null
  }

  const href =
    typeof child.props.href === "string" ? child.props.href : undefined
  const embedUrl = getYouTubeEmbedUrl(href)
  if (!embedUrl) {
    return null
  }

  return {
    embedUrl,
    title: getTextContent(child.props.children) || "YouTube video",
  }
}

export function MarkdownReader({ content }: MarkdownReaderProps) {
  if (!content) {
    return null
  }

  return (
    <div className="guide-content prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children, ...props }) => {
            const embed = getStandaloneYouTubeEmbed(children)
            if (embed) {
              return (
                <div className="not-prose bg-muted/30 my-4 overflow-hidden rounded-xl border">
                  <iframe
                    className="aspect-video w-full"
                    src={embed.embedUrl}
                    title={embed.title}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              )
            }

            return <p {...props}>{children}</p>
          },
          // Custom link handling to open external links in new tab
          a: ({ href, children, ...props }) => {
            const isExternal = href?.startsWith("http")
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="text-primary hover:text-primary/80 underline underline-offset-2"
                {...props}
              >
                {children}
              </a>
            )
          },
          // Ensure images from external URLs work
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              className="h-auto max-w-full rounded-lg"
              loading="lazy"
              {...props}
            />
          ),
          // Style code blocks
          pre: ({ children, ...props }) => (
            <pre className="bg-muted overflow-x-auto rounded-lg p-4" {...props}>
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className
            return isInline ? (
              <code
                className="bg-muted rounded px-1.5 py-0.5 text-sm"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
