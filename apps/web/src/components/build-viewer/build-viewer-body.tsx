import {
  type Arcane,
  DEFAULT_DEPLOYMENT_CONTEXT,
  type Mod,
} from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useMemo } from "react"

import {
  BuildSurface,
  getBuildLayout,
  resolveInitialArcanes,
  useArcaneSlots,
  useBuildDerived,
  useBuildSlots,
} from "@/components/build-editor"
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
import { GuideDisplay } from "./guide-display"
import { RelatedBuildsStrip } from "./related-builds"
import { VariantTabs } from "./variant-tabs"
import { ViewerHeader } from "./viewer-header"

interface BuildViewerBodyProps {
  build: BuildDetail
  category: BrowseCategory
  itemSlug: string
  embed: boolean
  /** Active variant index from `?v=`. Clamped against the variant count
   *  internally; pass `undefined` for the default (first variant). */
  activeIndex: number | undefined
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
}: BuildViewerBodyProps & {
  allMods: Mod[]
  allArcanes: Arcane[]
  helminthAbilities: HelminthAbility[]
}) {
  const { data: item } = useSuspenseQuery(itemQuery(category, itemSlug))
  const { data: imageMap } = useSuspenseQuery(imageMapQuery)
  const { data: conflictMap } = useSuspenseQuery(modConflictsQuery)
  const navigate = useNavigate()

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

  const setActiveIndex = (i: number) => {
    navigate({
      to: ".",
      params: true,
      search: (s) => (i === 0 ? { ...s, v: undefined } : { ...s, v: i }),
      replace: true,
    })
  }

  const categoryLabel = getCategoryLabel(category)
  const layout = useMemo(() => getBuildLayout(item, category), [item, category])
  const { isCompanion, normalSlotCount, auraSlotCount, arcaneCount } = layout

  const slots = useBuildSlots(normalSlotCount, {
    placed: saved.slots,
    formaPolarities: saved.formaPolarities,
    auraSlotCount,
    showExilus: layout.showExilus,
    showStance: layout.showStance,
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
                onSelect={setActiveIndex}
              />
            ) : undefined
          }
        />

        {!embed ? <RelatedBuildsStrip slug={build.slug} /> : null}

        {!embed && (
          <GuideDisplay build={build} activeVariant={variants[activeIndex]} />
        )}
      </div>
    </>
  )
}
