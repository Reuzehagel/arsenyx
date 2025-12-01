import { Icons } from "@/components/icons";

interface StatusBadgeProps {
  text: string;
}

export function StatusBadge({ text }: StatusBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-4 py-1.5 text-sm">
      <Icons.zap className="h-4 w-4 text-yellow-500" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
