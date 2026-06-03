import {
  type Arcane,
  DEFAULT_DEPLOYMENT_CONTEXT,
  type Mod,
} from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
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
import {
  getVariants,
  isLegacyBuildData,
  normalizeBuildData,
  refreshImagesFromMap,
  selectVariant,
} from "@/lib/codec/build-codec-adapter"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import type { BuildDetail } from "@/lib/queries/build-query"
import {
  helminthQuery,
  type HelminthAbility,
} from "@/lib/queries/helminth-query"
import { imageMapQuery } from "@/lib/queries/image-map-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"
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

  const categoryLabel = getCategoryLabel(category)
  const layout = useMemo(() => getBuildLayout(item, category), [item, category])
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
    { item, category, layout, slots, allArcanes, hasReactor },
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
    readOnly: true as const,
  }

  return (
    <>
      {!embed && (
        // min-height reserves the header's vertical space so the loadout below
        // doesn't jump when the lazy chunk resolves.
        <Suspense fallback={<div className="min-h-24" />}>
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
            abilities={item.abilities ?? []}
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
          item={item}
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
          topBarLayout={variants.length > 1 ? "centered" : "popover-only"}
          topBar={
            variants.length > 1 ? (
              <VariantTabs
                variants={variants}
                activeIndex={activeIndex}
                onSelect={onSelectVariant}
              />
            ) : undefined
          }
        />

        {!embed ? (
          <Suspense fallback={null}>
            <RelatedBuildsStrip slug={build.slug} />
          </Suspense>
        ) : null}

        {!embed && (
          <Suspense fallback={null}>
            <GuideDisplay build={build} activeVariant={variants[activeIndex]} />
          </Suspense>
        )}
      </div>
    </>
  )
}
