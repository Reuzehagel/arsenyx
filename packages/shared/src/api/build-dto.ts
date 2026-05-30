// Canonical wire shapes for the build-detail and build-list JSON the api
// emits (see apps/api/src/routes/_build-list.ts `serializeBuildDetail` /
// `serializeListRow`). The api is the single producer of these shapes and
// the web client is the consumer; keeping the contract here stops the two
// sides from drifting.
//
// Dates are serialized to ISO strings over the wire (Hono's `c.json`
// stringifies `Date` to ISO), so they are typed as `string` here even
// though the in-memory serializer rows hold `Date` objects.

export type BuildVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED"

/** Author summary embedded in build detail/list rows. */
export type BuildUserSummary = {
  id: string
  name: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
}

/** Organization summary embedded in build detail/list rows. */
export type BuildOrganizationSummary = {
  id: string
  name: string
  slug: string
  image: string | null
}

export type BuildItemSummary = {
  /** Stable DE identifier — used to resolve the CURRENT catalog image at
   *  render time, since the stored `imageName` rots across image-scheme
   *  changes (see useItemImage). */
  uniqueName: string
  category: string
  name: string
  imageName: string | null
}

export type BuildGuideSummary = {
  summary: string | null
  description: string | null
  updatedAt: string
}

/** Response shape of `GET /builds/:slug` (session route, with viewer state). */
export type BuildDetailResponse = {
  id: string
  slug: string
  name: string
  description: string | null
  visibility: BuildVisibility
  item: BuildItemSummary
  buildData: unknown
  hasShards: boolean
  hasGuide: boolean
  hideAuthor: boolean
  likeCount: number
  bookmarkCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  user: BuildUserSummary
  organization: BuildOrganizationSummary | null
  guide: BuildGuideSummary | null
  isOwner: boolean
  viewerHasLiked: boolean
  viewerHasBookmarked: boolean
}

/** A single row in a paginated build list response. */
export type BuildListItemResponse = {
  id: string
  slug: string
  name: string
  visibility: BuildVisibility
  likeCount: number
  bookmarkCount: number
  viewCount: number
  hasGuide: boolean
  hasShards: boolean
  hideAuthor: boolean
  createdAt: string
  updatedAt: string
  item: BuildItemSummary
  user: BuildUserSummary
  organization: BuildOrganizationSummary | null
}

/** Paginated build list response (`/builds`, `/users/:username/builds`, …). */
export type BuildListResponse = {
  builds: BuildListItemResponse[]
  total: number
  page: number
  limit: number
}
