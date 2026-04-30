import { Keyboard, Menu, Search } from "lucide-react"
import { useState } from "react"

import { CommandPalette } from "@/components/command-palette"
import { openHotkeyCheatSheet } from "@/components/hotkey-cheat-sheet"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { UserMenu } from "@/components/user-menu"
import { SITE_CONFIG, NAV_ITEMS, ROUTES } from "@/lib/constants"
import { useHotkey } from "@/lib/hotkeys"

export function Header() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useHotkey("mod+k", () => setPaletteOpen((v) => !v), { allowInEditable: true })

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="wrap flex h-14 items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation menu"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle>{SITE_CONFIG.name}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-2">
                {NAV_ITEMS.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    size="sm"
                    render={<Link href={item.href} />}
                    nativeButton={false}
                    onClick={() => setMobileNavOpen(false)}
                    className="justify-start"
                  >
                    {item.label}
                  </Button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link href={ROUTES.home} className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight md:text-xl">
              {SITE_CONFIG.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                render={<Link href={item.href} />}
                nativeButton={false}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            className="text-muted-foreground hidden gap-2 md:inline-flex"
            aria-label="Open search"
          >
            <Search data-icon="inline-start" />
            <span>Search…</span>
            <Kbd className="ml-2">Ctrl K</Kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPaletteOpen(true)}
            className="md:hidden"
            aria-label="Open search"
          >
            <Search />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openHotkeyCheatSheet}
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard />
          </Button>
          <UserMenu />
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  )
}
