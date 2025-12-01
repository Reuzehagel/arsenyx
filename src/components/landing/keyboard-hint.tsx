import { Icons } from "@/components/icons";

interface KeyboardHintProps {
  hint: string;
}

export function KeyboardHint({ hint }: KeyboardHintProps) {
  return (
    <div className="pt-4">
      <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <span>Press</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <Icons.command className="h-3 w-3" />K
        </kbd>
        <span>{hint}</span>
      </div>
    </div>
  );
}
