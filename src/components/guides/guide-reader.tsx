"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface GuideReaderProps {
  content: string;
}

export function GuideReader({ content }: GuideReaderProps) {
  if (!content) {
    return null;
  }

  return (
    <div className="guide-content prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom link handling to open external links in new tab
          a: ({ href, children, ...props }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Ensure images from external URLs work
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              className="max-w-full h-auto rounded-lg"
              loading="lazy"
              {...props}
            />
          ),
          // Style code blocks
          pre: ({ children, ...props }) => (
            <pre
              className="bg-muted p-4 rounded-lg overflow-x-auto"
              {...props}
            >
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code
                className="bg-muted px-1.5 py-0.5 rounded text-sm"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
