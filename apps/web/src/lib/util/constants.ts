// Site-wide constants and configuration
export const SITE_CONFIG = {
  name: "ARSENYX",
  description:
    "Open-source Warframe build planner. Fast, keyboard-first, and community-driven.",
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
  orgs: "/orgs",
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
  reportIssue: "https://github.com/Reuzehagel/arsenyx/issues/new/choose",
  wiki: "https://wiki.warframe.com",
  apiBase: "https://api.arsenyx.com",
  // Donation destination surfaced by the footer + post-publish nudge.
  koFi: "https://ko-fi.com/reuzehagel",
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
    { label: "Browse Builds", href: ROUTES.builds },
    { label: "Import Build", href: ROUTES.import },
  ],
  community: [
    { label: "Organizations", href: ROUTES.orgs },
    { label: "Documentation", href: ROUTES.docs },
    { label: "Changelog", href: ROUTES.changelog },
    { label: "GitHub", href: EXTERNAL_LINKS.github, external: true },
    {
      label: "Report an Issue",
      href: EXTERNAL_LINKS.reportIssue,
      external: true,
    },
  ],
  legal: [
    { label: "Privacy Policy", href: ROUTES.privacy },
    { label: "Terms of Service", href: ROUTES.terms },
    { label: "About", href: ROUTES.about },
  ],
} as const
