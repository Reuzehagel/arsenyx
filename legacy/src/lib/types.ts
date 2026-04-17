import { Icons } from "@/components/icons"

// Type for navigation links
export interface NavLink {
  readonly label: string
  readonly href: string
  readonly external?: boolean
}

// Type for footer link sections
export interface FooterLinkSection {
  readonly [key: string]: readonly NavLink[]
}

// Type for feature items
export interface Feature {
  readonly iconKey: keyof typeof Icons
  readonly title: string
  readonly description: string
}

// Type for CTA button
export interface CTAButton {
  readonly label: string
  readonly href: string
}

// Type for trust signal items
export interface TrustSignal {
  readonly label: string
  readonly href?: string
  readonly iconKey?: keyof typeof Icons
}

// Type for hero content
export interface HeroContent {
  readonly badge: string
  readonly headline: {
    readonly prefix: string
    readonly highlight: string
  }
  readonly description: string
  readonly cta: {
    readonly primary: CTAButton
    readonly secondary: CTAButton
  }
  readonly trustSignals: readonly TrustSignal[]
  readonly keyboardHint: string
}

// Type for CTA section content
export interface CTASectionContent {
  readonly headline: string
  readonly description: string
  readonly primaryCta: CTAButton
  readonly secondaryCta: CTAButton
}
