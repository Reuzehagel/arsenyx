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
  selectVariant,
} from "@/lib/codec/build-codec-adapter"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import type { BuildDetail } from "@/lib/queries/build-query"
import {
  helminthQuery,
  type HelminthAbility,
} from "@/lib/queries/helminth-query"
import { itemQuery } from "@/lib/queries/item-query"
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
 * buildData shape so legacy builds (which inline only uniqueNames) can
 * fetch the mod/arcane/helminth catalogs while new builds skip the
 * ~1.35MB download.
 */
export function BuildViewerBody(props: BuildViewerBodyProps) {
  // Only legacy BuildState-shape builds need the catalogs for uniqueName
  // lookup and image refresh (older wfcd hashed-slug filenames now 404
  // on the CDN). New-format builds carry full mod/arcane objects inline
  // in buildData.
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
  const navigate = useNavigate()

  const savedAll = useMemo(
    () =>
      normalizeBuildData(
        build.buildData,
        allMods,
        allArcanes,
        helminthAbilities,
      ),
    [build.buildData, allMods, allArcanes, helminthAbilities],
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
          arcaneCount={arcaneCount}
          slots={slots}
          arcanes={arcanes}
          arcaneConfig={arcaneConfig}
          sidebarProps={sidebarProps}
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
