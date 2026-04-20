import { Kbd, KbdGroup } from "@/components/ui/kbd"

interface KeyboardHintProps {
  hint: string
}

export function KeyboardHint({ hint }: KeyboardHintProps) {
  return (
    <div className="pt-4">
      <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
        <span>Press</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <span>{hint}</span>
      </div>
    </div>
  )
}
