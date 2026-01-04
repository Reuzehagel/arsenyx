"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/auth";
import { MobileNav } from "@/components/mobile-nav";
import { SITE_CONFIG, NAV_ITEMS, ROUTES } from "@/lib/constants";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6">
          {/* Mobile Navigation */}
          <MobileNav />

          {/* Logo */}
          <Link href={ROUTES.home} className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-bold tracking-tight">
              {SITE_CONFIG.name}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Button key={item.href} variant="ghost" size="sm" asChild>
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Icons.search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Icons.bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>
          <ThemeToggle />
          <div className="hidden md:flex">
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
