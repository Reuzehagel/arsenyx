import { cn } from "@/lib/utils"

type AvatarShape = "circle" | "square" | "rounded"

const SIZE_CLASSES: Record<number, string> = {
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
  const initial = fallback.charAt(0).toUpperCase()
  return (
    <div
      className={cn(
        "bg-muted flex shrink-0 items-center justify-center overflow-hidden font-medium",
        SIZE_CLASSES[size],
        SHAPE_CLASSES[shape],
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
