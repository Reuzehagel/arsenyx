"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">ARSENIX</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/browse">Browse</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/builds">Builds</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/templates">Templates</Link>
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Icons.search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-2">
            <Icons.plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Build</span>
          </Button>
          <Button variant="ghost" size="icon">
            <Icons.bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Icons.settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
          <Button variant="ghost" size="icon">
            <Icons.github className="h-4 w-4" />
            <span className="sr-only">GitHub</span>
          </Button>
          <Button variant="ghost" size="icon">
            <Icons.user className="h-4 w-4" />
            <span className="sr-only">Profile</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
