import { Icons } from "@/components/icons"

interface StatusBadgeProps {
  text: string
}

export function StatusBadge({ text }: StatusBadgeProps) {
  return (
    <div className="bg-background/80 inline-flex items-center gap-2 self-center rounded-full border px-4 py-1.5 text-sm backdrop-blur">
      <Icons.zap className="text-warning size-4" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  )
}
