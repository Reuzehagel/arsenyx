import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { HOTKEYS, HOTKEY_SCOPES, useHotkey } from "@/lib/hotkeys"

const OPEN_EVENT = "arsenyx:open-cheat-sheet"

/**
 * Global keyboard cheat-sheet. Renders the `HOTKEYS` list, opened by `?`
 * (Shift+/) anywhere on the site or by the keyboard button in the header.
 *
 * Mounted once at the root so the listener and dialog state live above any
 * route. The header button uses `openHotkeyCheatSheet()` to dispatch a window
 * event — avoids prop-drilling without introducing a context.
 */
export function HotkeyCheatSheet() {
  const [open, setOpen] = useState(false)

  // `?` is a shifted printable on most layouts; matching `e.key === "?"`
  // works regardless of which physical key produced it.
  useHotkey(
    (e) => e.key === "?",
    () => setOpen(true),
  )

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Context-aware. Some shortcuts only apply on certain pages.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 pt-1">
          {HOTKEY_SCOPES.map((scope) => {
            const rows = HOTKEYS.filter((h) => h.scope === scope)
            if (rows.length === 0) return null
            return (
              <section key={scope} className="flex flex-col gap-2">
                <h3 className="text-muted-foreground font-mono text-[10px] tracking-[0.22em] uppercase">
                  {scope}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {rows.map((row, i) => (
                    <li
                      key={`${scope}-${i}`}
                      className="flex items-baseline justify-between gap-4 text-sm"
                    >
                      <span className="text-foreground">{row.description}</span>
                      <KbdGroup className="shrink-0">
                        {row.keys.map((k, j) => (
                          <Kbd key={j}>{k}</Kbd>
                        ))}
                      </KbdGroup>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Open the cheat-sheet from anywhere — used by the header keyboard button. */
export function openHotkeyCheatSheet() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}
