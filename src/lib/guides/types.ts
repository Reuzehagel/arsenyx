// Guide content model types

// Guide categories
export const GUIDE_CATEGORIES = [
  "systems",
  "resources",
  "modes",
  "warframes",
  "gear",
] as const

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]

// Guide category metadata for display
export const GUIDE_CATEGORY_INFO: Record<
  GuideCategory,
  { label: string; description: string; icon: string }
> = {
  systems: {
    label: "Systems",
    description: "Core game systems and mechanics",
    icon: "settings",
  },
  resources: {
    label: "Resources",
    description: "Resource farming and management",
    icon: "coins",
  },
  modes: {
    label: "Game Modes",
    description: "Mission types and activities",
    icon: "gamepad",
  },
  warframes: {
    label: "Warframes",
    description: "Warframe-specific guides and tips",
    icon: "user",
  },
  gear: {
    label: "Gear",
    description: "Weapons, mods, and equipment",
    icon: "sword",
  },
}

// Guide status
export type GuideStatus = "draft" | "published"

// Main Guide type
export interface Guide {
  id: string
  slug: string
  title: string
  summary: string
  category: GuideCategory
  tags: string[]
  coverImage?: string
  readingTime: number // in minutes
  updatedAt: string // ISO date string
  createdAt: string // ISO date string
  author: {
    name: string
    avatar?: string
  }
  content: string // Markdown content
  status: GuideStatus
  isCurated?: boolean // true for featured/official guides
  relatedBuildIds?: string[]
  relatedGuideIds?: string[]
}

// Guide list item (for listings, without full content)
export interface GuideListItem {
  id: string
  slug: string
  title: string
  summary: string
  category: GuideCategory
  tags: string[]
  coverImage?: string
  readingTime: number
  updatedAt: string
  author: {
    name: string
    avatar?: string
  }
  status: GuideStatus
  isCurated?: boolean // true for featured/official guides
}

// Guide create/update input
export interface GuideInput {
  title: string
  summary: string
  category: GuideCategory
  tags: string[]
  coverImage?: string
  content: string // Markdown content
  status: GuideStatus
  relatedBuildIds?: string[]
  relatedGuideIds?: string[]
  authorName?: string
  authorAvatar?: string
}

// Filter options for guide listings
export interface GuideFilters {
  category?: GuideCategory
  tags?: string[]
  status?: GuideStatus
  search?: string
}

// Sort options for guide listings
export type GuideSortOption = "recent" | "title" | "readingTime"

// Helper to calculate reading time from markdown content
export function calculateReadingTime(content: string): number {
  // Rough estimate: 200 words per minute
  // Strip markdown syntax for more accurate word count
  const plainText = content
    .replace(/#{1,6}\s/g, "") // headings
    .replace(/\*\*|__/g, "") // bold
    .replace(/\*|_/g, "") // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // code
    .replace(/---/g, "") // hr

  const wordCount = plainText.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}
