import { useState } from "react"

import { proxyImage } from "@/lib/util/image-proxy"
import { cn } from "@/lib/util/utils"

type AvatarShape = "circle" | "square" | "rounded"

const SIZE_CLASSES: Record<number, string> = {
  4: "size-4 text-[10px]",
  5: "size-5 text-xs",
  6: "size-6 text-xs",
  7: "size-7 text-xs",
  8: "size-8 text-sm",
  9: "size-9 text-sm",
  10: "size-10 text-sm",
  20: "size-20 text-2xl",
}

const SHAPE_CLASSES: Record<AvatarShape, string> = {
  circle: "rounded-full",
  square: "rounded-lg",
  rounded: "rounded-md",
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** First letter or digit of a name ("🦊 Fox Den" → "F"), falling back to the
 *  first whole grapheme (never half an emoji), then "?". */
export function initialOf(name: string): string {
  const parts = Array.from(graphemes.segment(name.trim()), (s) => s.segment)
  const letter = parts.find((g) => /[\p{L}\p{N}]/u.test(g))
  return (letter ?? parts[0] ?? "?").toUpperCase()
}

export function UserAvatar({
  src,
  fallback,
  size = 10,
  shape = "circle",
  className,
}: {
  src?: string | null
  fallback: string
  size?: keyof typeof SIZE_CLASSES
  shape?: AvatarShape
  className?: string
}) {
  const initial = initialOf(fallback)
  const proxied = proxyImage(src)
  // Keyed on the URL so a new image gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = proxied && failedSrc !== proxied
  return (
    <div
      className={cn(
        "bg-muted flex shrink-0 items-center justify-center overflow-hidden font-medium",
        SIZE_CLASSES[size],
        SHAPE_CLASSES[shape],
        className,
      )}
    >
      {showImage ? (
        <img
          src={proxied}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(proxied)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
