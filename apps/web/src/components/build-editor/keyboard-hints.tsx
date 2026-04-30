import { X } from "lucide-react"
import { useState } from "react"

import { openHotkeyCheatSheet } from "@/components/hotkey-cheat-sheet"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "arsenyx.hotkeyHintDismissed"

/**
 * Persistent, low-contrast strip that surfaces the build-editor hotkeys.
 * Visible on every render of the editor — keyboard-first software lives or
 * dies on discoverability, and a permanent footer is the cheapest way to
 * make the keys obvious without modal interruption.
 */
export function KeyboardHintsStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pt-2 pb-4 text-[11px]",
        className,
      )}
    >
      <Hint keys={["↑", "↓", "←", "→"]} label="navigate" />
      <Hint keys={["−", "="]} label="rank" />
      <Hint keys={["/"]} label="search mods" />
      <Hint keys={["Esc"]} label="deselect" />
      <button
        type="button"
        onClick={openHotkeyCheatSheet}
        className="hover:text-foreground ml-auto inline-flex items-center gap-1 underline-offset-2 hover:underline"
      >
        <Kbd>?</Kbd>
        <span>all shortcuts</span>
      </button>
    </div>
  )
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <KbdGroup>
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </KbdGroup>
      <span>{label}</span>
    </span>
  )
}

/**
 * One-time onboarding banner shown the first time a user lands in the build
 * editor. Dismissed forever via localStorage. The persistent strip beneath
 * the editor handles ongoing discovery.
 */
export function KeyboardHintBanner() {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      /* private mode — banner just won't persist, fine */
    }
    setDismissed(true)
  }

  return (
    <div className="bg-muted/30 flex items-center gap-3 rounded-md border border-dashed px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        Keyboard-first: arrows move between slots, <Kbd>−</Kbd> / <Kbd>=</Kbd>{" "}
        rank a mod, <Kbd>/</Kbd> opens mod search. Press <Kbd>?</Kbd> any time
        for the full list.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto inline-flex shrink-0 items-center justify-center rounded-sm p-1"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return true
  }
}
