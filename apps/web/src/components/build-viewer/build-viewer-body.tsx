import type { BuildDetailResponse } from "@arsenyx/shared/api/build-dto"
import { clampVariantIndex } from "@arsenyx/shared/warframe/build-doc"
import type { Arcane, BrowseCategory } from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { type ComponentProps, lazy, Suspense, useMemo } from "react"

// Deep imports (not barrels) so the router-less embed entry stays lean.
import { BuildSurface } from "@/components/build-loadout/build-surface"
import { useBuildDerived } from "@/components/build-loadout/use-build-derived"
import { useLoadoutStats } from "@/components/build-loadout/use-loadout-stats"
import { VariantTabs } from "@/components/build-loadout/variant-tabs"
import { buildTrailEntry } from "@/components/partner-builds/build-trail"
import { RelatedBuildsStripFallback } from "@/components/partner-builds/related-builds-fallback"
import { extrasFromSaved } from "@/lib/build/extras"
import { getBuildLayout } from "@/lib/build/layout"
import { loadoutFromSaved } from "@/lib/build/loadout"
import type { DetailItem } from "@/lib/catalog"
import {
  type BuildCatalogs,
  getVariants,
  loadBuildData,
  resolveVariantMode,
  selectVariant,
} from "@/lib/codec/build-codec-adapter"
import { hasGuideContent } from "@/lib/guide"
import { makeRefResolver } from "@/lib/guide-refs"
import { useFormAxis } from "@/lib/hooks/use-form-axis"
import { catalogQueriesFor } from "@/lib/queries/build-query"
import { imageMapQuery } from "@/lib/queries/image-map-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { authorName } from "@/lib/util/user-display"

import { EmbedStrips } from "./embed-strips"
import { ViewerHeaderSkeleton } from "./viewer-header-skeleton"

// Full-page-only chrome. Lazy-loaded so the embed entry (and the embed branch
// below, which never renders these) doesn't bundle TanStack Router's Link /
// useNavigate (ViewerHeader, RelatedBuildsStrip) or react-markdown
// (GuideDisplay) — that's what keeps the embed bundle off the full app shell.
const ViewerHeader = lazy(() =>
  import("./viewer-header").then((m) => ({ default: m.ViewerHeader })),
)
const RelatedBuildsStrip = lazy(() =>
  import("@/components/partner-builds/related-builds").then((m) => ({
    default: m.RelatedBuildsStrip,
  })),
)
const GuideDisplay = lazy(() =>
  import("./guide-display").then((m) => ({ default: m.GuideDisplay })),
)

interface BuildViewerBodyProps {
  build: BuildDetailResponse
  category: BrowseCategory
  itemSlug: string
  embed: boolean
  /** Active variant index from `?v=`. Clamped against the variant count
   *  internally; pass `undefined` for the default (first variant). */
  activeIndex: number | undefined
  /** Called when the user picks a variant tab. The parent owns how this is
   *  persisted — the full page writes `?v=` via the router; the embed entry
   *  keeps it in local state (no router). The index is already a valid
   *  0-based tab index from VariantTabs. */
  onSelectVariant: (index: number) => void
}

/**
 * Read-only viewer body for `/builds/$slug`. Branches on legacy-vs-new
 * buildData shape so legacy builds can fetch the full mod/arcane/helminth
 * catalogs (to rebuild their mods) while new builds skip the ~1.35MB
 * download. Both paths re-resolve images via the compact image-map.json
 * (see loadBuildData), so a build never shows a stale/404 icon.
 */
export function BuildViewerBody(props: BuildViewerBodyProps) {
  const catalogs = catalogQueriesFor(props.build.buildData)
  if (catalogs) {
    return <BuildViewerBodyWithCatalog {...props} queries={catalogs} />
  }
  return <BuildViewerBodyInner {...props} catalogs={NO_CATALOGS} />
}

const NO_CATALOGS: BuildCatalogs = {}
const NO_ARCANES: Arcane[] = []

function BuildViewerBodyWithCatalog({
  queries: [modsOpts, arcanesOpts, helminthOpts],
  ...props
}: BuildViewerBodyProps & {
  queries: NonNullable<ReturnType<typeof catalogQueriesFor>>
}) {
  const { data: mods } = useSuspenseQuery(modsOpts)
  const { data: arcanes } = useSuspenseQuery(arcanesOpts)
  const { data: helminth } = useSuspenseQuery(helminthOpts)
  const catalogs = useMemo(
    () => ({ mods, arcanes, helminth }),
    [mods, arcanes, helminth],
  )
  return <BuildViewerBodyInner {...props} catalogs={catalogs} />
}

function BuildViewerBodyInner({
  build,
  category,
  itemSlug,
  catalogs,
  embed,
  activeIndex: rawActiveIndex,
  onSelectVariant,
}: BuildViewerBodyProps & { catalogs: BuildCatalogs }) {
  const { data: item } = useSuspenseQuery(itemQuery(category, itemSlug))
  const { data: imageMap } = useSuspenseQuery(imageMapQuery)
  const { data: conflictMap } = useSuspenseQuery(modConflictsQuery)

  const savedAll = useMemo(
    () => loadBuildData(build.buildData, { ...catalogs, imageMap }),
    [build.buildData, catalogs, imageMap],
  )

  const variants = useMemo(() => getVariants(savedAll), [savedAll])
  // Memoized so MarkdownBody's anchor renderer keeps a stable component
  // identity across re-renders — a fresh resolver each render would remount
  // every guide-ref hover card (and drop open popovers) on variant switches.
  const resolveGuideRef = useMemo(
    () =>
      makeRefResolver(savedAll.guideRefs?.mods, savedAll.guideRefs?.arcanes),
    [savedAll.guideRefs],
  )
  const activeIndex = clampVariantIndex({ variants }, rawActiveIndex ?? 0)
  const saved = useMemo(
    () => selectVariant(savedAll, activeIndex),
    [savedAll, activeIndex],
  )
  const variantMode = useMemo(() => resolveVariantMode(savedAll), [savedAll])

  // Reserve height for the guide's lazy chunk only when GuideDisplay will
  // render something (else the reservation leaves an empty gap).
  const activeVariant = variants[activeIndex]
  const hasGuide = hasGuideContent(build, activeVariant)

  const {
    isTwin,
    activeFormIndex,
    formAbilities,
    formNames,
    formVariants,
    formActiveLocalIndex,
    effectiveItem,
  } = useFormAxis(item, variants, activeIndex)
  const selectForm = (formIndex: number) => {
    const target = variants.findIndex((v) => (v.formIndex ?? 0) === formIndex)
    if (target >= 0) onSelectVariant(target)
  }

  // Stable identity so the related-builds strip can memoize off it (this
  // component re-renders on every popover interaction).
  const trailEntry = useMemo(
    () => buildTrailEntry(build, item.imageName, activeIndex),
    [build, item.imageName, activeIndex],
  )

  const layout = useMemo(
    () => getBuildLayout(effectiveItem, category),
    [effectiveItem, category],
  )
  const loadout = useMemo(
    () => loadoutFromSaved(saved, item, category, layout),
    [saved, item, category, layout],
  )
  const extras = useMemo(
    () => extrasFromSaved(saved, item, category),
    [saved, item, category],
  )

  const { arcaneConfig, totalEndoCost, formaCount, capacity } = useBuildDerived(
    {
      item: effectiveItem,
      category,
      layout,
      placed: loadout.placed,
      formaPolarities: loadout.formaPolarities,
      allArcanes: catalogs.arcanes ?? NO_ARCANES,
      hasReactor: extras.hasReactor,
    },
  )

  const sidebarProps = {
    item,
    category,
    extras,
    capacity,
    formAbilities,
  }
  const multiVariant = variants.length > 1 || isTwin

  return (
    <>
      {!embed && (
        // The fallback mirrors ViewerHeader's exact DOM structure (same card,
        // same clamp-sized image box, same row/column flex rules) so it
        // occupies the identical height at every breakpoint. A plain min-height
        // under-reserved on desktop and the header's lazy chunk resolving then
        // shoved the loadout ~50px down — the page's last remaining layout
        // shift. A structural skeleton tracks the real height responsively, so
        // the swap moves nothing.
        <Suspense fallback={<ViewerHeaderSkeleton />}>
          <ViewerHeader
            build={build}
            author={authorName(build.user)}
            totalEndoCost={totalEndoCost}
            formaCount={formaCount}
            category={category}
            itemSlug={itemSlug}
            itemImageName={item.imageName ?? undefined}
          />
        </Suspense>
      )}

      <div className="flex flex-col gap-4">
        {embed && (
          <EmbedStripsForLoadout
            item={item}
            category={category}
            loadout={loadout}
            abilities={formAbilities ?? item.abilities ?? []}
            extras={extras}
            slug={build.slug}
          />
        )}
        <BuildSurface
          embed={embed}
          item={effectiveItem}
          category={category}
          layout={layout}
          loadout={loadout}
          arcaneConfig={arcaneConfig}
          sidebarProps={sidebarProps}
          conflicts={conflictMap}
          topBarLayout={multiVariant ? "centered" : "popover-only"}
          topBar={
            multiVariant ? (
              <VariantTabs
                variants={formVariants.map((f) => f.v)}
                activeIndex={formActiveLocalIndex}
                onSelect={(local) =>
                  onSelectVariant(formVariants[local].globalIndex)
                }
                formNames={isTwin ? formNames : undefined}
                activeFormIndex={activeFormIndex}
                onSelectForm={isTwin ? selectForm : undefined}
                note={
                  variantMode === "independent"
                    ? "Each variant has its own forma and Archon Shards"
                    : undefined
                }
              />
            ) : undefined
          }
        />

        {!embed ? (
          <Suspense fallback={<RelatedBuildsStripFallback slug={build.slug} />}>
            <RelatedBuildsStrip slug={build.slug} current={trailEntry} />
          </Suspense>
        ) : null}

        {!embed && (
          <Suspense fallback={hasGuide ? <div className="min-h-40" /> : null}>
            <GuideDisplay
              build={build}
              activeVariant={activeVariant}
              resolveGuideRef={resolveGuideRef}
            />
          </Suspense>
        )}
      </div>
    </>
  )
}

/** The embed's ability strip shows stats outside the sidebar, so only the
 *  embed computes them here. */
function EmbedStripsForLoadout({
  item,
  category,
  loadout,
  abilities,
  extras,
  slug,
}: {
  item: DetailItem
  category: BrowseCategory
  loadout: ReturnType<typeof loadoutFromSaved>
  abilities: ComponentProps<typeof EmbedStrips>["abilities"]
  extras: ComponentProps<typeof EmbedStrips>["extras"]
  slug: string
}) {
  const { warframeStats } = useLoadoutStats({
    item,
    category,
    placedMods: loadout.placed,
    placedArcanes: loadout.arcanes,
    shards: extras.shards,
  })
  return (
    <EmbedStrips
      category={category}
      itemName={item.name}
      itemImageName={item.imageName ?? undefined}
      abilities={abilities}
      abilityTotals={warframeStats ?? undefined}
      extras={extras}
      slug={slug}
    />
  )
}
