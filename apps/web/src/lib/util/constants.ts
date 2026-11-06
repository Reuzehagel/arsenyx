import { DEFAULT_DESCRIPTION, SITE_NAME } from "@arsenyx/shared/seo/site"

// Site-wide constants and configuration
export const SITE_CONFIG = {
  // Wordmark spelling; the page-title/og name is SITE_NAME.
  name: "ARSENYX",
  description: DEFAULT_DESCRIPTION,
  author: SITE_NAME,
  year: new Date().getFullYear(),
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
  // Donation destination surfaced by the footer + post-publish nudge.
  koFi: "https://ko-fi.com/reuzehagel",
} as const

// Navigation items for header
export const NAV_ITEMS = [
  { label: "Browse", href: "/browse" },
  { label: "Builds", href: "/builds" },
  { label: "Orgs", href: "/orgs" },
  { label: "Profiles", href: "/users" },
] as const

// Footer link sections
export const FOOTER_LINKS = {
  build: [
    { label: "Browse Items", href: "/browse" },
    { label: "Browse Builds", href: "/builds" },
    { label: "Import Build", href: "/import" },
  ],
  community: [
    { label: "Organizations", href: "/orgs" },
    { label: "Profiles", href: "/users" },
    { label: "Documentation", href: "/docs" },
    { label: "Changelog", href: "/changelog" },
    { label: "GitHub", href: EXTERNAL_LINKS.github, external: true },
    {
      label: "Report an Issue",
      href: EXTERNAL_LINKS.reportIssue,
      external: true,
    },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "About", href: "/about" },
  ],
} as const
