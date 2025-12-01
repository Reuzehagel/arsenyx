"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_CONFIG, NAV_ITEMS, ROUTES } from "@/lib/constants";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={ROUTES.home} className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">
              {SITE_CONFIG.name}
            </span>
          </Link>
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
          <Button variant="ghost" size="default" className="gap-2" asChild>
            <Link href={ROUTES.create}>
              <Icons.plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Build</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon">
            <Icons.bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon">
            <Icons.user className="h-4 w-4" />
            <span className="sr-only">Profile</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
