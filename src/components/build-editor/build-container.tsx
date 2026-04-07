"use client"

import { DndContext, DragOverlay } from "@dnd-kit/core"
import { useCallback, useMemo } from "react"

import { ArcaneDragGhost } from "@/components/arcane-card/arcane-card"
import { CompactModCard, type ModRarity } from "@/components/mod-card/mod-card"
import { getBuildLayout } from "@/lib/builds/layout"
import { isWarframeCategory } from "@/lib/warframe/categories"
import type { Mod, Arcane } from "@/lib/warframe/types"

import { BuildEditorGuideSection } from "./build-editor-guide-section"
import { BuildEditorHeader } from "./build-editor-header"
import { BuildEditorSearchPanel } from "./build-editor-search-panel"
import { useBuildDragDrop } from "./hooks/use-build-drag-drop"
import { useBuildGuide } from "./hooks/use-build-guide"
import { useBuildPersistence } from "./hooks/use-build-persistence"
import {
  useBuildState,
  extractItemStats,
  type BuildContainerProps,
} from "./hooks/use-build-state"
import { useBuildUI } from "./hooks/use-build-ui"
import { ItemSidebar } from "./item-sidebar"
import { ModGrid } from "./mod-grid"
import { useBuildKeyboard } from "./use-build-keyboard"

export type { BuildContainerProps } from "./hooks/use-build-state"

export function BuildContainer({
  item,
  category,
  categoryLabel,
  compatibleMods,
  compatibleArcanes = [],
  importedBuild,
  savedBuildId,
  readOnly = false,
  isOwner = false,
  initialGuide,
  initialPartnerBuilds = [],
  initialOrganizationSlug,
  initialVisibility,
}: BuildContainerProps) {
  // --- Hooks ---

  const {
    buildState,
    dispatch,
    placeModInSlot,
    moveMod,
    handleRemoveMod,
    handleChangeRank,
    handleApplyForma,
    handleToggleReactor,
    handleClearBuild,
    handleHelminthAbilityChange,
    placeArcaneInSlot,
    moveArcane,
    handleRemoveArcane,
    handleChangeArcaneRank,
    handlePlaceShard,
    handleRemoveShard,
    usedModNames,
    usedArcaneNames,
    arcaneDataMap,
    capacityStatus,
    totalEndoCost,
    formaCount,
  } = useBuildState({
    item,
    category,
    compatibleMods,
    compatibleArcanes,
    importedBuild,
  })

  const {
    isAuthenticated,
    isEditMode,
    setIsEditMode,
    canEdit,
    activeSlotId,
    setActiveSlotId,
    showCopied,
    handleSelectSlot,
    handleCopyBuild,
  } = useBuildUI({
    savedBuildId,
    readOnly,
    isOwner,
    buildState,
  })

  const {
    activeDragItem,
    sensors,
    dndContextId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useBuildDragDrop({
    canEdit,
    compatibleMods,
    placeModInSlot,
    moveMod,
    placeArcaneInSlot,
    moveArcane,
    setActiveSlotId,
  })

  const {
    guideSummary,
    setGuideSummary,
    guideDescription,
    setGuideDescription,
    partnerBuilds,
    availableBuilds,
  } = useBuildGuide({
    itemUniqueName: item.uniqueName,
    savedBuildId,
    isOwner,
    isAuthenticated,
    canEdit,
    initialGuide,
    initialPartnerBuilds,
  })

  const hydrateBuildState = useCallback(
    (partial: Partial<import("@/lib/warframe/types").BuildState>) => {
      dispatch({ type: "HYDRATE", state: partial, item, category })
    },
    [dispatch, item, category],
  )

  const {
    buildId,
    buildName,
    setBuildName,
    saveStatus,
    publishDialogOpen,
    setPublishDialogOpen,
    handlePublish,
    handleCancel,
    organizationSlug,
    setOrganizationSlug,
    currentVisibility,
  } = useBuildPersistence({
    item,
    category,
    buildState,
    hydrateBuildState,
    savedBuildId,
    importedBuild,
    isAuthenticated,
    canEdit,
    guideSummary,
    guideDescription,
    partnerBuildIds: partnerBuilds.map((b) => b.slug),
    setIsEditMode,
    initialOrganizationSlug,
    initialVisibility,
  })

  // --- Orchestration callbacks (bridge multiple hooks) ---

  const handlePlaceMod = useCallback(
    (mod: Mod, rank: number = mod.fusionLimit) => {
      const isAuraMod = mod.compatName?.toUpperCase() === "AURA"

      if (!isAuraMod && !activeSlotId) return

      if (isAuraMod && buildState.auraSlot) {
        placeModInSlot(mod, rank, "aura-0")
        return
      }

      if (activeSlotId) {
        placeModInSlot(mod, rank, activeSlotId)
      }

      if (isAuraMod) return

      const currentIndex = parseInt(activeSlotId?.replace("normal-", "") ?? "")
      if (!isNaN(currentIndex) && currentIndex < 7) {
        setActiveSlotId(`normal-${currentIndex + 1}`)
      } else {
        setActiveSlotId(null)
      }
    },
    [activeSlotId, placeModInSlot, setActiveSlotId, buildState.auraSlot],
  )

  const handlePlaceArcane = useCallback(
    (arcane: Arcane, rank: number) => {
      if (!activeSlotId || !activeSlotId.startsWith("arcane-")) return

      const slotIndex = parseInt(activeSlotId.replace("arcane-", ""))
      if (isNaN(slotIndex)) return

      placeArcaneInSlot(arcane, rank, slotIndex)

      if (slotIndex === 0) {
        setActiveSlotId("arcane-1")
      } else {
        setActiveSlotId(null)
      }
    },
    [activeSlotId, placeArcaneInSlot, setActiveSlotId],
  )

  // --- Per-slot arcane filtering for Archguns ---
  // Archguns have 2 arcane slots: slot 0 = primary arcanes, slot 1 = secondary arcanes
  const filteredArcanes = useMemo(() => {
    if (category !== "archwing") return compatibleArcanes
    if (!activeSlotId?.startsWith("arcane-")) return compatibleArcanes

    const slotIndex = parseInt(activeSlotId.replace("arcane-", ""))
    if (slotIndex === 0) {
      // Primary arcanes only
      return compatibleArcanes.filter((a) =>
        a.type?.toLowerCase().includes("primary"),
      )
    }
    if (slotIndex === 1) {
      // Secondary arcanes only
      return compatibleArcanes.filter((a) => {
        const t = a.type?.toLowerCase() ?? ""
        return t.includes("secondary") || t.includes("pax")
      })
    }
    return compatibleArcanes
  }, [category, compatibleArcanes, activeSlotId])

  // --- Keyboard navigation ---

  const isWarframeOrNecramech = isWarframeCategory(category)
  const isCompanion = category === "companions"
  const layout = getBuildLayout(item, category)

  useBuildKeyboard({
    onSelectSlot: handleSelectSlot,
    onOpenSearch: () => {},
    onCloseSearch: () => {
      setActiveSlotId(null)
    },
    onCopyBuild: handleCopyBuild,
    onClearBuild: handleClearBuild,
    hasAuraSlot: layout.hasAuraSlot,
    hasExilusSlot: layout.hasExilusSlot,
  })

  // --- Derived ---

  const itemStats = useMemo(() => extractItemStats(item), [item])

  // --- Render ---

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="container px-4 py-4 md:py-6">
        <BuildEditorHeader
          item={item}
          categoryLabel={categoryLabel}
          totalEndoCost={totalEndoCost}
          formaCount={formaCount}
          isOwner={isOwner}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          savedBuildId={savedBuildId}
          canEdit={canEdit}
          isAuthenticated={isAuthenticated}
          buildName={buildName}
          setBuildName={setBuildName}
          buildId={buildId}
          saveStatus={saveStatus}
          publishDialogOpen={publishDialogOpen}
          setPublishDialogOpen={setPublishDialogOpen}
          handlePublish={handlePublish}
          handleCancel={handleCancel}
          handleCopyBuild={handleCopyBuild}
          showCopied={showCopied}
          organizationSlug={organizationSlug}
          onOrganizationChange={setOrganizationSlug}
          currentVisibility={currentVisibility}
        />

        <div className="flex flex-col gap-4">
          {/* Top row: Sidebar + Mod Grid */}
          <div className="flex flex-col gap-4 lg:relative lg:block">
            <div className="bg-card w-full rounded-lg border lg:absolute lg:top-0 lg:bottom-0 lg:left-0 lg:w-[260px] lg:overflow-y-auto lg:overscroll-y-contain">
              <ItemSidebar
                buildState={buildState}
                capacityStatus={capacityStatus}
                onToggleReactor={handleToggleReactor}
                onCopyBuild={handleCopyBuild}
                onClearBuild={handleClearBuild}
                showCopied={showCopied}
                itemStats={itemStats}
                item={item}
                readOnly={!canEdit}
                onHelminthAbilityChange={handleHelminthAbilityChange}
                onPlaceShard={handlePlaceShard}
                onRemoveShard={handleRemoveShard}
              />
            </div>

            <div className="bg-card min-w-0 flex-1 rounded-lg border p-2 sm:p-4 lg:ml-[calc(260px+1rem)]">
              <ModGrid
                auraSlot={buildState.auraSlot}
                exilusSlot={buildState.exilusSlot}
                normalSlots={buildState.normalSlots}
                activeSlotId={canEdit ? activeSlotId : null}
                onSelectSlot={canEdit ? handleSelectSlot : () => {}}
                onRemoveMod={canEdit ? handleRemoveMod : () => {}}
                onChangeRank={canEdit ? handleChangeRank : () => {}}
                onApplyForma={canEdit ? handleApplyForma : () => {}}
                isWarframe={isWarframeOrNecramech}
                slotsPerRow={isCompanion ? 5 : 4}
                draggedMod={
                  canEdit &&
                  (activeDragItem?.type === "search-mod" ||
                    activeDragItem?.type === "placed-mod")
                    ? activeDragItem.mod
                    : undefined
                }
                arcaneSlots={buildState.arcaneSlots}
                onRemoveArcane={canEdit ? handleRemoveArcane : () => {}}
                onChangeArcaneRank={canEdit ? handleChangeArcaneRank : () => {}}
                draggedArcane={
                  (canEdit &&
                    (activeDragItem?.type === "search-arcane"
                      ? activeDragItem.arcane
                      : activeDragItem?.type === "placed-arcane"
                        ? activeDragItem.arcane
                        : undefined)) ||
                  undefined
                }
                arcaneDataMap={arcaneDataMap}
                readOnly={!canEdit}
              />
            </div>
          </div>

          {/* Mod/Arcane Search Grid */}
          {canEdit && (
            <BuildEditorSearchPanel
              activeSlotId={activeSlotId}
              activeDragItem={activeDragItem}
              compatibleArcanes={filteredArcanes}
              compatibleMods={compatibleMods}
              usedArcaneNames={usedArcaneNames}
              usedModNames={usedModNames}
              onPlaceArcane={handlePlaceArcane}
              onPlaceMod={handlePlaceMod}
            />
          )}

          {/* Build Guide */}
          <BuildEditorGuideSection
            canEdit={canEdit}
            savedBuildId={savedBuildId}
            isAuthenticated={isAuthenticated}
            guideSummary={guideSummary}
            setGuideSummary={setGuideSummary}
            guideDescription={guideDescription}
            setGuideDescription={setGuideDescription}
            partnerBuilds={partnerBuilds}
            availableBuilds={availableBuilds}
          />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragItem &&
        (activeDragItem.type === "search-mod" ||
          activeDragItem.type === "placed-mod") ? (
          <div className="cursor-grabbing rounded-lg opacity-90 shadow-xl">
            <CompactModCard
              mod={activeDragItem.mod as Mod}
              rarity={(activeDragItem.mod.rarity || "Common") as ModRarity}
              rank={
                activeDragItem.rank ??
                ("rank" in activeDragItem.mod ? activeDragItem.mod.rank : 0)
              }
              isMaxRank={
                (activeDragItem.rank ??
                  ("rank" in activeDragItem.mod
                    ? activeDragItem.mod.rank
                    : 0)) >= (activeDragItem.mod.fusionLimit ?? 0)
              }
              disableAnimation
            />
          </div>
        ) : activeDragItem &&
          (activeDragItem.type === "search-arcane" ||
            activeDragItem.type === "placed-arcane") ? (
          <div className="cursor-grabbing rounded-lg opacity-90 shadow-xl">
            <ArcaneDragGhost arcane={activeDragItem.arcane} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
