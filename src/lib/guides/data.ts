import { getSeedGuides, getSeedGuideBySlug } from "./seed-data"
// Data layer for guides - abstracts storage for future backend swap
import type {
  Guide,
  GuideListItem,
  GuideInput,
  GuideFilters,
  GuideSortOption,
  GuideCategory,
} from "./types"
import { calculateReadingTime } from "./types"

// Local storage key for draft guides
const DRAFT_STORAGE_KEY = "arsenyx_guide_drafts"

// =============================================================================
// GUIDE QUERIES
// =============================================================================

/**
 * Get all published guides for listings
 */
export function getPublishedGuides(): GuideListItem[] {
  const guides = getSeedGuides().filter((g) => g.status === "published")
  return guides.map(guideToListItem)
}

/**
 * Get guides filtered and sorted
 */
export function getGuides(options?: {
  filters?: GuideFilters
  sort?: GuideSortOption
}): GuideListItem[] {
  let guides = getSeedGuides()

  // Filter by status (default to published only)
  const statusFilter = options?.filters?.status ?? "published"
  guides = guides.filter((g) => g.status === statusFilter)

  // Filter by category
  if (options?.filters?.category) {
    guides = guides.filter((g) => g.category === options.filters?.category)
  }

  // Filter by tags
  if (options?.filters?.tags && options.filters.tags.length > 0) {
    guides = guides.filter((g) =>
      options.filters?.tags?.some((tag) => g.tags.includes(tag)),
    )
  }

  // Filter by search query
  if (options?.filters?.search) {
    const searchLower = options.filters.search.toLowerCase()
    guides = guides.filter(
      (g) =>
        g.title.toLowerCase().includes(searchLower) ||
        g.summary.toLowerCase().includes(searchLower) ||
        g.tags.some((t) => t.toLowerCase().includes(searchLower)),
    )
  }

  // Sort
  const sortOption = options?.sort ?? "recent"
  guides = sortGuides(guides, sortOption)

  return guides.map(guideToListItem)
}

/**
 * Get a single guide by slug
 */
export function getGuideBySlug(slug: string): Guide | null {
  const guide = getSeedGuideBySlug(slug)
  if (!guide) return null
  return guide
}

/**
 * Get all unique tags from guides
 */
export function getAllTags(): string[] {
  const guides = getSeedGuides()
  const tagSet = new Set<string>()
  for (const guide of guides) {
    for (const tag of guide.tags) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
}

/**
 * Get guides by category for sidebar navigation
 */
export function getGuidesByCategory(): Record<GuideCategory, GuideListItem[]> {
  const guides = getPublishedGuides()
  const byCategory: Record<GuideCategory, GuideListItem[]> = {
    systems: [],
    resources: [],
    modes: [],
    warframes: [],
    gear: [],
  }

  for (const guide of guides) {
    byCategory[guide.category].push(guide)
  }

  return byCategory
}

/**
 * Get featured guides (for homepage or featured section)
 */
export function getFeaturedGuides(limit = 3): GuideListItem[] {
  // For now, just return the most recently updated guides
  return getGuides({ sort: "recent" }).slice(0, limit)
}

/**
 * Get related guides
 */
export function getRelatedGuides(guideId: string, limit = 3): GuideListItem[] {
  const guide = getSeedGuides().find((g) => g.id === guideId)
  if (!guide) return []

  // If guide has explicit related guide IDs, use those
  if (guide.relatedGuideIds && guide.relatedGuideIds.length > 0) {
    const related = guide.relatedGuideIds
      .map((id) => getSeedGuides().find((g) => g.id === id))
      .filter((g): g is Guide => g !== undefined && g.status === "published")
      .slice(0, limit)
    return related.map(guideToListItem)
  }

  // Otherwise, find guides in the same category or with overlapping tags
  const sameCategory = getSeedGuides().filter(
    (g) =>
      g.id !== guideId &&
      g.status === "published" &&
      (g.category === guide.category ||
        g.tags.some((t) => guide.tags.includes(t))),
  )

  return sameCategory.slice(0, limit).map(guideToListItem)
}

// =============================================================================
// GUIDE MUTATIONS (for future use)
// =============================================================================

/**
 * Create a new guide (draft)
 */
export function createGuide(input: GuideInput): Guide {
  const now = new Date().toISOString()
  const slug = generateSlug(input.title)

  const guide: Guide = {
    id: `guide-${Date.now()}`,
    slug,
    title: input.title,
    summary: input.summary,
    category: input.category,
    tags: input.tags,
    coverImage: input.coverImage,
    readingTime: calculateReadingTime(input.content),
    createdAt: now,
    updatedAt: now,
    author: {
      name: input.authorName ?? "Anonymous",
      avatar: input.authorAvatar,
    },
    content: input.content,
    status: input.status,
    relatedBuildIds: input.relatedBuildIds,
    relatedGuideIds: input.relatedGuideIds,
  }

  // For now, save to localStorage
  saveDraftGuide(guide)

  return guide
}

/**
 * Update an existing guide
 */
export function updateGuide(
  slug: string,
  input: Partial<GuideInput>,
): Guide | null {
  const existing = getGuideBySlug(slug)
  if (!existing) return null

  const updated: Guide = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
    readingTime: input.content
      ? calculateReadingTime(input.content)
      : existing.readingTime,
  }

  // For now, save to localStorage
  saveDraftGuide(updated)

  return updated
}

// =============================================================================
// DRAFT STORAGE (localStorage)
// =============================================================================

/**
 * Save a draft guide to localStorage
 */
export function saveDraftGuide(guide: Guide): void {
  if (typeof window === "undefined") return

  const drafts = getDraftGuides()
  const existingIndex = drafts.findIndex((d) => d.id === guide.id)

  if (existingIndex >= 0) {
    drafts[existingIndex] = guide
  } else {
    drafts.push(guide)
  }

  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts))
}

/**
 * Get all draft guides from localStorage
 */
export function getDraftGuides(): Guide[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as Guide[]
  } catch {
    return []
  }
}

/**
 * Get a single draft guide by ID
 */
export function getDraftGuide(id: string): Guide | null {
  const drafts = getDraftGuides()
  return drafts.find((d) => d.id === id) ?? null
}

/**
 * Delete a draft guide
 */
export function deleteDraftGuide(id: string): void {
  if (typeof window === "undefined") return

  const drafts = getDraftGuides().filter((d) => d.id !== id)
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts))
}

// =============================================================================
// HELPERS
// =============================================================================

function guideToListItem(guide: Guide): GuideListItem {
  return {
    id: guide.id,
    slug: guide.slug,
    title: guide.title,
    summary: guide.summary,
    category: guide.category,
    tags: guide.tags,
    coverImage: guide.coverImage,
    readingTime: guide.readingTime,
    updatedAt: guide.updatedAt,
    author: guide.author,
    status: guide.status,
  }
}

function sortGuides(guides: Guide[], sort: GuideSortOption): Guide[] {
  switch (sort) {
    case "recent":
      return [...guides].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    case "title":
      return [...guides].sort((a, b) => a.title.localeCompare(b.title))
    case "readingTime":
      return [...guides].sort((a, b) => a.readingTime - b.readingTime)
    default:
      return guides
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
