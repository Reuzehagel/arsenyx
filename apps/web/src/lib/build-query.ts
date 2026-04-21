import type { LichBonusElement, Polarity } from "@arsenyx/shared/warframe/types"
import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import type { PlacedArcane, PlacedMod, SlotId } from "@/components/build-editor"
import { API_URL } from "@/lib/constants"
import type { HelminthAbility } from "@/lib/helminth-query"
import type { PlacedShard } from "@/lib/shards"

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
      const r = await fetch(`${API_URL}/builds/${encodeURIComponent(slug)}`, {
        credentials: "include",
      })
      if (r.status === 404) throw notFound()
      if (!r.ok) throw new Error("failed to load build")
      return r.json()
    },
  })
