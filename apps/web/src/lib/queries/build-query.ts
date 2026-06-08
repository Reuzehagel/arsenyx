import type { BuildDetailResponse } from "@arsenyx/shared/api/build-dto"
import type {
  DeploymentContext,
  LichBonusElement,
  Polarity,
} from "@arsenyx/shared/warframe/types"
import { queryOptions } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import type { PlacedArcane, PlacedMod, SlotId } from "@/components/build-editor"
import type { HelminthAbility } from "@/lib/queries/helminth-query"
import type { PlacedShard } from "@/lib/shards"
import { apiFetch, ApiError } from "@/lib/util/api-client"

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
  kitgunComponents?: { grip: string; loader: string }
  lichBonusElement?: LichBonusElement
  incarnonEnabled?: boolean
  incarnonPerks?: (string | null)[]
  deploymentContext?: DeploymentContext

  // Multi-variant support (added 2026-05-23). When present, length >= 1
  // and the top-level mod/arcane fields mirror variants[0] for legacy
  // viewer compatibility.
  variants?: SavedVariant[]
}

/**
 * The per-variant *data* fields — the ones that differ between variants and are
 * mirrored on top-level `SavedBuildData` for legacy clients. Derived from
 * `SavedVariant` by excluding identity (`id`/`label`), the structural loadout
 * (`slots`/`arcanes`, always present with a default), and the separately-handled
 * per-variant guide. Deriving by exclusion makes the set self-maintaining: a new
 * `SavedVariant` field automatically becomes a per-variant data field, and
 * `pickPerVariantData` (build-codec-adapter.ts) — the single point every
 * converter threads these through — then fails to compile until it's handled, so
 * no converter can silently drop it. (Adding a field that's genuinely *not*
 * per-variant data just means listing it in the exclusion below.)
 */
export type PerVariantDataField = Exclude<
  keyof SavedVariant,
  "id" | "label" | "slots" | "arcanes" | "guideSummary" | "guideDescription"
>

/** Canonical wire shape lives in `@arsenyx/shared/api/build-dto`; re-exported
 *  under the historical name so existing consumers keep importing it here. */
export type BuildDetail = BuildDetailResponse

/**
 * @param countView when `false`, fetches `/builds/:slug?view=0` so the server
 *   skips the view-count bump (and its per-view cookie) and serves a
 *   browser-cacheable response. Used by the embed entry — embed impressions
 *   are not build views. The payload is identical either way, so the query key
 *   stays `["build", slug]` (full page and embed never coexist in one document).
 */
export const buildQuery = (slug: string, opts?: { countView?: boolean }) =>
  queryOptions({
    queryKey: ["build", slug],
    queryFn: async (): Promise<BuildDetail> => {
      const qs = opts?.countView === false ? "?view=0" : ""
      try {
        return await apiFetch<BuildDetail>(
          `/builds/${encodeURIComponent(slug)}${qs}`,
        )
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) throw notFound()
        throw err
      }
    },
  })
