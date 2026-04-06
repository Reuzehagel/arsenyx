"use client"

import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"

interface MarkdownReaderProps {
  content: string
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
