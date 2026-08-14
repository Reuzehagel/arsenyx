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
  /** Admin-granted trust flag — verified orgs render purple, others muted. */
  verified: boolean
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
  formaCount: number
  createdAt: string
  updatedAt: string
  user: BuildUserSummary
  organization: BuildOrganizationSummary | null
  guide: BuildGuideSummary | null
  isOwner: boolean
  viewerHasLiked: boolean
  viewerHasBookmarked: boolean
}

/** One entry in a build's edit log (`GET /builds/:slug/revisions`). Consecutive
 *  saves by the same editor are folded into one entry server-side, so `at` is
 *  the newest save in the group and `changes` is their merged result. */
export type BuildRevisionResponse = {
  id: string
  at: string
  kind: "CREATED" | "EDITED"
  /** Null when the account has since been deleted — the entry survives the
   *  user (BuildRevision.editorId is SetNull), un-attributed. */
  editor: BuildUserSummary | null
  /** Author-typed notes from the folded saves, newest first. */
  notes: string[]
  changes: BuildChangeResponse[]
  /** How many raw saves this entry represents. >1 means it was folded. */
  saves: number
}

/** Mirrors `BuildChange` from @arsenyx/shared/warframe/build-diff. */
export type BuildChangeResponse = {
  op: "add" | "remove" | "modify" | "info"
  scope?: string
  label: string
  detail?: string
}

export type BuildRevisionsResponse = {
  revisions: BuildRevisionResponse[]
  /** True when older entries exist beyond the returned window. */
  truncated: boolean
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
  formaCount: number
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
