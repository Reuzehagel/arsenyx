// Site-wide constants and configuration
export const SITE_CONFIG = {
  name: "ARSENYX",
  description:
    "Open-source Warframe build planner. Fast, keyboard-first, and community-driven.",
  tagline: "Build. Share. Dominate.",
  github: "https://github.com/Reuzehagel/arsenyx",
  author: "Arsenyx",
  year: new Date().getFullYear(),
} as const

// Route definitions for type-safe navigation
export const ROUTES = {
  home: "/",
  browse: "/browse",
  builds: "/builds",
  create: "/create",
  import: "/import",
  modsTest: "/mods-test",
  feed: "/feed",
  docs: "/docs",
  changelog: "/changelog",
  privacy: "/privacy",
  terms: "/terms",
  about: "/about",
  signIn: "/auth/signin",
  signInError: "/auth/error",
  profile: "/profile",
  myBuilds: "/builds/mine",
  bookmarks: "/bookmarks",
  settings: "/settings",
  admin: "/admin",
} as const

// API base URL (Hono). Override with VITE_API_URL in .env.
export const API_URL =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8787"

// External links
export const EXTERNAL_LINKS = {
  github: "https://github.com/Reuzehagel/arsenyx",
  wfcd: "https://warframestat.us",
} as const

// Navigation items for header
export const NAV_ITEMS = [
  { label: "Browse", href: ROUTES.browse },
  { label: "Builds", href: ROUTES.builds },
] as const

// Footer link sections
export const FOOTER_LINKS = {
  build: [
    { label: "Browse Items", href: ROUTES.browse },
    { label: "Import Build", href: ROUTES.import },
  ],
  community: [
    { label: "Build Feed", href: ROUTES.feed },
    { label: "Documentation", href: ROUTES.docs },
    { label: "Changelog", href: ROUTES.changelog },
    { label: "GitHub", href: EXTERNAL_LINKS.github, external: true },
  ],
  legal: [
    { label: "Privacy Policy", href: ROUTES.privacy },
    { label: "Terms of Service", href: ROUTES.terms },
    { label: "About", href: ROUTES.about },
  ],
} as const

// Feature list for landing page
export const FEATURES = [
  {
    iconKey: "keyboard" as const,
    title: "Keyboard First",
    description:
      "Navigate and build with keyboard shortcuts. Create builds in under 60 seconds without touching your mouse.",
  },
  {
    iconKey: "upload" as const,
    title: "Smart Import",
    description:
      "Import builds from Overframe or upload a screenshot of your in-game Arsenal.",
  },
  {
    iconKey: "users" as const,
    title: "Community Driven",
    description:
      "Browse, like, and comment on community builds. Open source and built by Warframe players.",
  },
  {
    iconKey: "chartSpline" as const,
    title: "Real-time Stats",
    description:
      "See your stats update in real-time as you add mods, arcanes, and archon shards.",
  },
] as const

// Hero section content
export const HERO_CONTENT = {
  badge: "Early Demo / Beta - Work in Progress",
  headline: {
    prefix: "Build. Share.",
    highlight: "Dominate.",
  },
  description:
    "The open-source Warframe build planner. Fast, keyboard-first, and built for the community. Plan your perfect loadout in seconds.",
  cta: {
    primary: { label: "Start Building", href: ROUTES.browse },
    secondary: { label: "Start Building", href: ROUTES.browse },
  },
  trustSignals: [
    {
      label: "Open Source",
      href: EXTERNAL_LINKS.github,
      iconKey: "github" as const,
    },
    { label: "No ads, ever" },
  ],
  keyboardHint: "to search anywhere",
} as const

// Features section content
export const FEATURES_SECTION = {
  headline: "Built for Speed",
  description:
    "Every feature designed to get you from idea to shareable build as fast as possible.",
} as const

// CTA section content
export const CTA_CONTENT = {
  headline: "Ready to build your perfect loadout?",
  description:
    "Join thousands of Tenno who use Arsenyx to plan, share, and optimize their builds.",
  primaryCta: { label: "Start Building", href: ROUTES.browse },
  secondaryCta: { label: "Star on GitHub", href: EXTERNAL_LINKS.github },
} as const
