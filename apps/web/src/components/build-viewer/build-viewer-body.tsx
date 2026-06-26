import {
  type Arcane,
  DEFAULT_DEPLOYMENT_CONTEXT,
  type Mod,
} from "@arsenyx/shared/warframe/types"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { lazy, Suspense, useMemo } from "react"

import {
  getBuildLayout,
  useBuildDerived,
} from "@/components/build-editor/build-derived"
// Deep imports (not the `@/components/build-editor` barrel) so the read-only
// viewer doesn't drag in editor-only modules like ModSearchGrid — Rollup can't
// tree-shake those back out of the barrel, and the embed entry must stay lean.
import { BuildSurface } from "@/components/build-editor/build-surface"
import { resolveInitialArcanes } from "@/components/build-editor/layout"
import { useArcaneSlots } from "@/components/build-editor/use-arcane-slots"
import { useBuildSlots } from "@/components/build-editor/use-build-slots"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getVariants,
  isLegacyBuildData,
  normalizeBuildData,
  refreshImagesFromMap,
  selectVariant,
} from "@/lib/codec/build-codec-adapter"
import { applyFormPolarities, deriveFormAxis } from "@/lib/form-axis"
import { makeRefResolver } from "@/lib/guide-refs"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import { type BuildDetail, hasGuideContent } from "@/lib/queries/build-query"
import {
  helminthQuery,
  type HelminthAbility,
} from "@/lib/queries/helminth-query"
import { imageMapQuery } from "@/lib/queries/image-map-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"
import {
  partnerBuildsQuery,
  type PartnerBuild,
} from "@/lib/queries/partner-builds-query"
import { padShards } from "@/lib/shards"
import { authorName } from "@/lib/util/user-display"
import { getCategoryLabel, type BrowseCategory } from "@/lib/warframe"

import { EmbedStrips } from "./embed-strips"
import { VariantTabs } from "./variant-tabs"

// Full-page-only chrome. Lazy-loaded so the embed entry (and the embed branch
// below, which never renders these) doesn't bundle TanStack Router's Link /
// useNavigate (ViewerHeader, RelatedBuildsStrip) or react-markdown
// (GuideDisplay) — that's what keeps the embed bundle off the full app shell.
const ViewerHeader = lazy(() =>
  import("./viewer-header").then((m) => ({ default: m.ViewerHeader })),
)
const RelatedBuildsStrip = lazy(() =>
  import("./related-builds").then((m) => ({ default: m.RelatedBuildsStrip })),
)
const GuideDisplay = lazy(() =>
  import("./guide-display").then((m) => ({ default: m.GuideDisplay })),
)

interface BuildViewerBodyProps {
  build: BuildDetail
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
 * (see refreshImagesFromMap), so a build never shows a stale/404 icon.
 */
export function BuildViewerBody(props: BuildViewerBodyProps) {
  // Only legacy BuildState-shape builds need the full catalogs to rebuild
  // mods from uniqueNames. New-format builds carry full mod/arcane objects
  // inline; their stale inline imageNames are refreshed from image-map.json
  // in BuildViewerBodyInner.
  if (isLegacyBuildData(props.build.buildData)) {
    return <BuildViewerBodyWithCatalog {...props} />
  }
  return (
    <BuildViewerBodyInner
      {...props}
      allMods={[]}
      allArcanes={[]}
      helminthAbilities={[]}
    />
  )
}

function BuildViewerBodyWithCatalog(props: BuildViewerBodyProps) {
  const { data: allArcanes } = useSuspenseQuery(arcanesQuery)
  const { data: allMods } = useSuspenseQuery(modsQuery)
  const { data: helminthAbilities } = useSuspenseQuery(helminthQuery)
  return (
    <BuildViewerBodyInner
      {...props}
      allMods={allMods}
      allArcanes={allArcanes}
      helminthAbilities={helminthAbilities}
    />
  )
}

function BuildViewerBodyInner({
  build,
  category,
  itemSlug,
  allMods,
  allArcanes,
  helminthAbilities,
  embed,
  activeIndex: rawActiveIndex,
  onSelectVariant,
}: BuildViewerBodyProps & {
  allMods: Mod[]
  allArcanes: Arcane[]
  helminthAbilities: HelminthAbility[]
}) {
  const { data: item } = useSuspenseQuery(itemQuery(category, itemSlug))
  const { data: imageMap } = useSuspenseQuery(imageMapQuery)
  const { data: conflictMap } = useSuspenseQuery(modConflictsQuery)

  // Re-resolve mod/arcane/helminth images by uniqueName. New-format builds
  // carry stale inline imageNames (frozen at save time); legacy builds are
  // already fresh via the catalog rebuild, so this just confirms them.
  const savedAll = useMemo(
    () =>
      refreshImagesFromMap(
        normalizeBuildData(
          build.buildData,
          allMods,
          allArcanes,
          helminthAbilities,
        ),
        imageMap,
      ),
    [build.buildData, allMods, allArcanes, helminthAbilities, imageMap],
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
  const activeIndex = useMemo(() => {
    const raw = rawActiveIndex ?? 0
    if (raw < 0) return 0
    if (raw >= variants.length) return variants.length - 1
    return raw
  }, [rawActiveIndex, variants.length])
  const saved = useMemo(
    () => selectVariant(savedAll, activeIndex),
    [savedAll, activeIndex],
  )

  // Reserve height for the guide's lazy chunk only when GuideDisplay will
  // actually render something (else the reservation leaves an empty gap above
  // the footer). hasGuideContent is the same resolver GuideDisplay renders
  // through, so the two can't drift.
  const activeVariant = variants[activeIndex]
  const hasGuide = hasGuideContent(build, activeVariant)

  // Twin-frames (Sirius & Orion): the active variant's form picks the ability
  // set (each form carries its own per-variant Helminth), and the variant tabs
  // show only that form's variants. Shared with the editor via `deriveFormAxis`;
  // no-op for normal frames. The form toggle jumps to the target form's first
  // variant.
  const {
    isTwin,
    activeFormIndex,
    formAbilities,
    formNames,
    formVariants,
    formActiveLocalIndex,
    formPolarities,
    formAuraPolarity,
    formExilusPolarity,
  } = useMemo(
    () => deriveFormAxis(item, variants, activeIndex),
    [item, variants, activeIndex],
  )
  // Polarity-overridden view of the item (active form's innate polarities) for
  // the layout, slot grid, and forma/capacity maths — see `applyFormPolarities`.
  const effectiveItem = useMemo(
    () =>
      applyFormPolarities(item, {
        isTwin,
        formPolarities,
        formAuraPolarity,
        formExilusPolarity,
      }),
    [isTwin, item, formPolarities, formAuraPolarity, formExilusPolarity],
  )
  const selectForm = (formIndex: number) => {
    const target = variants.findIndex((v) => (v.formIndex ?? 0) === formIndex)
    if (target >= 0) onSelectVariant(target)
  }

  const categoryLabel = getCategoryLabel(category)
  const layout = useMemo(
    () => getBuildLayout(effectiveItem, category),
    [effectiveItem, category],
  )
  const { isCompanion, normalSlotCount, auraSlotCount, arcaneCount } = layout

  const slots = useBuildSlots(normalSlotCount, {
    placed: saved.slots,
    formaPolarities: saved.formaPolarities,
    auraSlotCount,
    showExilus: layout.showExilus,
    showStance: layout.showStance,
    stanceLocked: layout.stanceLocked,
    initialSelected: null,
  })
  const arcanes = useArcaneSlots(
    arcaneCount,
    resolveInitialArcanes(item, saved.arcanes),
  )
  const shards = useMemo(() => padShards(saved.shards), [saved.shards])
  const helminth = saved.helminth ?? {}
  const hasReactor = saved.hasReactor ?? true
  const zawComponents = saved.zawComponents
  const kitgunComponents = saved.kitgunComponents
  const lichBonusElement = saved.lichBonusElement ?? null
  const incarnonEnabled = saved.incarnonEnabled ?? false
  const incarnonPerks = saved.incarnonPerks ?? []
  const deploymentContext =
    saved.deploymentContext ?? DEFAULT_DEPLOYMENT_CONTEXT

  const { arcaneConfig, totalEndoCost, formaCount, capacity } = useBuildDerived(
    { item: effectiveItem, category, layout, slots, allArcanes, hasReactor },
  )

  const sidebarProps = {
    item,
    category,
    capacityUsed: capacity.used,
    capacityMax: capacity.max,
    hasReactor,
    onToggleReactor: () => {},
    shards,
    onSetShard: () => {},
    helminth,
    onSetHelminth: () => {},
    zawComponents,
    kitgunComponents,
    lichBonusElement,
    incarnonEnabled,
    incarnonPerks,
    deploymentContext,
    placedMods: slots.placed,
    placedArcanes: arcanes.placed,
    formAbilities,
    readOnly: true as const,
  }

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
            categoryLabel={categoryLabel}
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
          <EmbedStrips
            category={category}
            itemName={item.name}
            itemImageName={item.imageName ?? undefined}
            abilities={formAbilities ?? item.abilities ?? []}
            helminth={helminth}
            shards={shards}
            zawComponents={zawComponents}
            kitgunComponents={kitgunComponents}
            incarnonEnabled={incarnonEnabled}
            incarnonPerks={incarnonPerks}
            lichBonusElement={lichBonusElement}
            slug={build.slug}
          />
        )}
        <BuildSurface
          mode="view"
          embed={embed}
          item={effectiveItem}
          category={category}
          isCompanion={isCompanion}
          normalSlotCount={normalSlotCount}
          auraSlotCount={auraSlotCount}
          showExilus={layout.showExilus}
          showStance={layout.showStance}
          arcaneCount={arcaneCount}
          slots={slots}
          arcanes={arcanes}
          arcaneConfig={arcaneConfig}
          sidebarProps={sidebarProps}
          conflicts={conflictMap}
          topBarLayout={
            variants.length > 1 || isTwin ? "centered" : "popover-only"
          }
          topBar={
            variants.length > 1 || isTwin ? (
              <VariantTabs
                variants={formVariants.map((f) => f.v)}
                activeIndex={formActiveLocalIndex}
                onSelect={(local) =>
                  onSelectVariant(formVariants[local].globalIndex)
                }
                formNames={isTwin ? formNames : undefined}
                activeFormIndex={activeFormIndex}
                onSelectForm={isTwin ? selectForm : undefined}
              />
            ) : undefined
          }
        />

        {!embed ? (
          <Suspense fallback={<RelatedBuildsStripFallback slug={build.slug} />}>
            <RelatedBuildsStrip slug={build.slug} />
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

/**
 * Height-matched placeholder for the lazy {@link RelatedBuildsStrip}. The strip
 * fetches its partners with a plain useQuery and renders nothing until they
 * arrive, so without a reservation it pops in after the route commits and shoves
 * the guide + footer down (the build pages' dominant CLS). The loader warms the
 * partners query, so by first paint we already know whether the strip will
 * render — reserve its one-row height only when it's non-empty, so builds
 * without partners don't get a phantom gap. Mirrors related-builds.tsx's outer
 * structure (heading + a single chip row) so the reserved height matches the
 * real strip at every breakpoint — keep the two in sync.
 */
function RelatedBuildsStripFallback({ slug }: { slug: string }) {
  const partners = useQueryClient().getQueryData<PartnerBuild[]>(
    partnerBuildsQuery(slug).queryKey,
  )
  if (!partners || partners.length === 0) return null
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-24" />
      <div className="-mx-1 flex gap-2 px-1 pb-1">
        <div className="bg-card flex w-80 shrink-0 items-center gap-3 rounded-md border py-2 pr-4 pl-2">
          <Skeleton className="size-12 shrink-0 rounded" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Height-matched placeholder for the lazy {@link ViewerHeader}. Deliberately
 * mirrors that component's outer structure — the `bg-card … p-4` card, the
 * clamp-sized image box (which dominates the card height on desktop), and the
 * same row/column flex rules — so it reserves the identical height across
 * breakpoints and the loadout below doesn't shift when the real header swaps
 * in. Keep this in sync with viewer-header.tsx's outer layout. `animate-pulse`
 * marks it as a loading state; `aria-hidden` keeps the bars out of the a11y
 * tree.
 */
function ViewerHeaderSkeleton() {
  return (
    <div className="bg-card mb-4 rounded-lg border p-4" aria-hidden>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Skeleton className="size-[clamp(4rem,8vw,6rem)] shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  )
}
