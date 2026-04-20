import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Button } from "@/components/ui/button"
import {
  FEATURES,
  FEATURES_SECTION,
  HERO_CONTENT,
  CTA_CONTENT,
} from "@/lib/constants"

import { DataPills } from "./data-pills"
import { FeatureCard } from "./feature-card"
import { HeroBackground } from "./hero-background"
import { KeyboardHint } from "./keyboard-hint"
import { StatusBadge } from "./status-badge"
import { TrustSignalItem } from "./trust-signal"

export function HeroSection() {
  const { badge, headline, description, cta, trustSignals, keyboardHint } =
    HERO_CONTENT

  return (
    <section className="relative overflow-hidden border-b">
      <HeroBackground />

      <div className="container py-24 md:py-32">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 text-center">
          <StatusBadge text={badge} />

          {/* Headline */}
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl">
              {headline.prefix}{" "}
              <span className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-transparent">
                {headline.highlight}
              </span>
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg md:text-xl">
              {description}
            </p>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              render={<Link href={cta.secondary.href} />}
              nativeButton={false}
            >
              {cta.secondary.label}
            </Button>
          </div>

          {/* Trust signals */}
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            {trustSignals.map((signal, index) => (
              <span key={signal.label} className="contents">
                <TrustSignalItem {...signal} />
                {index < trustSignals.length - 1 && (
                  <span className="text-muted-foreground/50">•</span>
                )}
              </span>
            ))}
          </div>

          <DataPills />

          <KeyboardHint hint={keyboardHint} />
        </div>
      </div>
    </section>
  )
}

export function FeaturesSection() {
  return (
    <section className="bg-muted/30 border-b">
      <div className="container py-24">
        <div className="mx-auto mb-16 flex max-w-3xl flex-col gap-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {FEATURES_SECTION.headline}
          </h2>
          <p className="text-muted-foreground text-lg">
            {FEATURES_SECTION.description}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function CTASection() {
  const { headline, description, secondaryCta } = CTA_CONTENT

  return (
    <section className="border-b">
      <div className="container py-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {headline}
          </h2>
          <p className="text-muted-foreground text-lg">{description}</p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              render={
                <Link
                  href={secondaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
            >
              <Icons.github data-icon="inline-start" />
              {secondaryCta.label}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
