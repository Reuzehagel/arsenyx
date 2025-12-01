"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icons } from "@/components/icons";

const features = [
  {
    icon: Icons.keyboard,
    title: "Keyboard First",
    description:
      "Navigate and build with keyboard shortcuts. Create builds in under 60 seconds without touching your mouse.",
  },
  {
    icon: Icons.upload,
    title: "Smart Import",
    description:
      "Import builds from Overframe or upload a screenshot of your in-game Arsenal.",
  },
  {
    icon: Icons.users,
    title: "Community Driven",
    description:
      "Browse, vote, and comment on community builds. Open source and built by Warframe players.",
  },
  {
    icon: Icons.chartSpline,
    title: "Real-time Stats",
    description:
      "See your stats update in real-time as you add mods, arcanes, and archon shards.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Icons.keyboard;
  title: string;
  description: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary mb-2">
          <Icon className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b">
      {/* Background gradient effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 aspect-square w-full max-w-2xl bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 aspect-square w-full max-w-xl bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-4 py-1.5 text-sm">
            <Icons.zap className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground">
              Now with real-time stat calculations
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Build. Share.{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Dominate.
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
              The open-source Warframe build planner. Fast, keyboard-first, and
              built for the community. Plan your perfect loadout in seconds.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="gap-2 w-full sm:w-auto" asChild>
              <Link href="/create">
                Create Build
                <Icons.arrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              asChild
            >
              <Link href="/browse">Browse Items</Link>
            </Button>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link
              href="https://github.com/arsenix"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.github className="h-4 w-4" />
              Open Source
            </Link>
            <span className="text-muted-foreground/50">•</span>
            <span>Auto-synced with WFCD</span>
            <span className="text-muted-foreground/50">•</span>
            <span>No ads, ever</span>
          </div>

          {/* Keyboard shortcut hint */}
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span>Press</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <Icons.command className="h-3 w-3" />K
              </kbd>
              <span>to search anywhere</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section className="border-b bg-muted/30">
      <div className="container py-24">
        <div className="mx-auto max-w-3xl text-center space-y-4 mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Built for Speed
          </h2>
          <p className="text-lg text-muted-foreground">
            Every feature designed to get you from idea to shareable build as
            fast as possible.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="border-b">
      <div className="container py-24">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to build your perfect loadout?
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of Tenno who use Arsenix to plan, share, and optimize
            their builds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="gap-2 w-full sm:w-auto" asChild>
              <Link href="/create">
                Start Building
                <Icons.arrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" className="gap-2" asChild>
              <Link
                href="https://github.com/arsenix"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.github className="h-4 w-4" />
                Star on GitHub
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
