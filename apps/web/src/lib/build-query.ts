import type {
  DeploymentContext,
  LichBonusElement,
  Polarity,
} from "@arsenyx/shared/warframe/types"
import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import type { PlacedArcane, PlacedMod, SlotId } from "@/components/build-editor"
import { apiFetch, ApiError } from "@/lib/api-client"
import type { HelminthAbility } from "@/lib/helminth-query"
import type { PlacedShard } from "@/lib/shards"

/**
 * Per-variant slice stored inside `SavedBuildData.variants`. When the
 * `variants` array is present (length >= 1), the per-variant fields here
 * supersede the legacy top-level `slots`/`arcanes`/`incarnon*`/
 * `deploymentContext` fields. Top-level fields stay populated for the
 * active variant so old clients that ignore `variants` still render the
 * default loadout — graceful degradation, not a hard cutover.
 */
export type SavedVariant = {
  id: string
  label: string
  slots: Partial<Record<SlotId, PlacedMod>>
  arcanes: (PlacedArcane | null)[]
  helminth?: Record<number, HelminthAbility>
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  deploymentContext?: DeploymentContext
  /** Optional per-variant guide. When absent, the viewer falls back to
   *  the build-wide guide from BuildDetail.guide. Stored inside
   *  `buildData.variants[i]` (JSON column) — no separate DB row. */
  guideSummary?: string
  guideDescription?: string
}

/** Shape stored in `Build.buildData` (Prisma JSON). */
export type SavedBuildData = {
  version?: number
  slots?: Partial<Record<SlotId, PlacedMod>>
  formaPolarities?: Partial<Record<SlotId, Polarity>>
  arcanes?: (PlacedArcane | null)[]
  shards?: (PlacedShard | null)[]
  hasReactor?: boolean
  helminth?: Record<number, HelminthAbility>
  zawComponents?: { grip: string; link: string }
  lichBonusElement?: LichBonusElement
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  deploymentContext?: DeploymentContext

  // Multi-variant support (added 2026-05-23). When present, length >= 1
  // and the top-level mod/arcane fields mirror variants[0] for legacy
  // viewer compatibility.
  variants?: SavedVariant[]
}

export type BuildDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED"
  item: {
    uniqueName: string
    category: string
    name: string
    imageName: string | null
  }
  buildData: unknown
  hasShards: boolean
  hasGuide: boolean
  hideAuthor: boolean
  likeCount: number
  bookmarkCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string | null
    username: string | null
    displayUsername: string | null
    image: string | null
  }
  organization: {
    id: string
    name: string
    slug: string
    image: string | null
  } | null
  guide: {
    summary: string | null
    description: string | null
    updatedAt: string
  } | null
  isOwner: boolean
  viewerHasLiked: boolean
  viewerHasBookmarked: boolean
}

export const buildQuery = (slug: string) =>
  queryOptions({
    queryKey: ["build", slug],
    queryFn: async (): Promise<BuildDetail> => {
      try {
        return await apiFetch<BuildDetail>(
          `/builds/${encodeURIComponent(slug)}`,
        )
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) throw notFound()
        throw err
      }
    },
  })
