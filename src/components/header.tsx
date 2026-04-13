import Link from "next/link"

import { UserMenu } from "@/components/auth"
import { Icons } from "@/components/icons"
import { MobileNav } from "@/components/mobile-nav"
import { SearchCommand } from "@/components/search-command"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SITE_CONFIG, NAV_ITEMS, ROUTES } from "@/lib/constants"

export function Header() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6">
          {/* Mobile Navigation */}
          <MobileNav />

          {/* Logo */}
          <Link href={ROUTES.home} className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight md:text-xl">
              {SITE_CONFIG.name}
            </span>
          </Link>

          {/* Desktop Navigation */}
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
          <SearchCommand />
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Icons.bell />
            <span className="sr-only">Notifications</span>
          </Button>
          <ThemeToggle />
          <div className="hidden md:flex">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
