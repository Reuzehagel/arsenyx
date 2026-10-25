import { getBlockedByConflict } from "@arsenyx/shared/warframe/mods"
import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EditorHeader } from "@/components/create-editor/editor-header"
import { SearchPanel } from "@/components/create-editor/search-panel"
import { useRivenDialog } from "@/components/create-editor/use-riven-dialog"
import { authClient } from "@/lib/auth-client"
import { useHotkey } from "@/lib/hooks/hotkeys"
import { myOrgsQuery } from "@/lib/queries/org-query"
import { cn } from "@/lib/util/utils"
import { getCategoryLabel, type BrowseCategory } from "@/lib/warframe"

import { AutoFormaDialog } from "./auto-forma-dialog"
import { useBuildDerived, getBuildLayout } from "./build-derived"
import { BuildSurface } from "./build-surface"
import { DragController } from "./drag-controller"
import { bumpVariantEpoch } from "./editor-cache"
import { makeEditorCapture } from "./editor-capture"
import { EditorVariantBar } from "./editor-variant-bar"
import { GuideEditor } from "./guide-editor"
import { KeyboardHintBanner } from "./keyboard-hints"
import { getPlexusGroupForIndex } from "./layout"
import { resolveInitialArcanes } from "./layout"
import { PublishDialog } from "./publish-dialog"
import {
  RankHoverProvider,
  rankTargetsEqual,
  type RankHoverApi,
  type RankHoverTarget,
} from "./rank-hover"
import { useArcaneSlots } from "./use-arcane-slots"
import { useAutoFormaPlanner } from "./use-auto-forma-planner"
import { useBuildSave } from "./use-build-save"
import {
  canBeAlternate,
  useBuildSlots,
  slotKind,
  type SlotId,
} from "./use-build-slots"
import { useDraftAutosave } from "./use-draft-autosave"
import { useEditorHydration } from "./use-editor-hydration"
import { useEditorUndo } from "./use-editor-undo"
import { useEditorVariants } from "./use-editor-variants"
import { useGuideState } from "./use-guide-state"
import { useItemExtras } from "./use-item-extras"
import { useSlotKeyboardNav } from "./use-keyboard-nav"
import { usePublishSettings } from "./use-publish-settings"
import { useRankHotkey } from "./use-rank-hotkey"
import { useVariantActions } from "./use-variant-actions"

export interface EditorShellSearch {
  item: string
  category: BrowseCategory
  build?: string
  draft?: string
  share?: string
  /** Active variant index for multi-variant builds. 0 (or undefined) =
   *  first variant. */
  v?: number
}

/**
 * Composition root for the build editor: wires the hydration, variant,
 * slot, extras, undo, save and autosave hooks together and renders the
 * editor surface. State lives in the hooks; this file only connects them.
 */
export function EditorShell({ search }: { search: EditorShellSearch }) {
  const {
    item: slug,
    category,
    build: buildSlug,
    draft: draftId,
    share: shareEncoded,
    v: activeVariantIndex = 0,
  } = search
  const {
    item,
    existingBuild,
    allMods,
    allArcanes,
    incarnonAdapterImages,
    conflictMap,
    draft,
    storeKey,
    storedDraft,
    localDraft,
    savedDataAll,
  } = useEditorHydration({
    slug,
    category,
    buildSlug,
    draftId,
    shareEncoded,
  })

  const {
    variants,
    setVariants,
    clampedActiveIndex,
    formAxis: {
      activeFormIndex,
      formAbilities,
      formNames,
      formVariants,
      formActiveLocalIndex,
    },
    effectiveItem,
    savedData,
    cachedShared,
    writeShared,
  } = useEditorVariants({ storeKey, savedDataAll, item, activeVariantIndex })

  const categoryLabel = getCategoryLabel(category)

  const layout = useMemo(
    () => getBuildLayout(effectiveItem, category),
    [effectiveItem, category],
  )
  const {
    isCompanion,
    normalSlotCount,
    auraSlotCount,
    arcaneCount,
    showExilus,
    showStance,
    stanceLocked,
  } = layout
  const slots = useBuildSlots(normalSlotCount, {
    placed: savedData.slots,
    // Forma is build-wide (shared across variants); use the cached
    // override so unsaved forma edits survive variant switches.
    formaPolarities: cachedShared?.formaPolarities ?? savedData.formaPolarities,
    auraSlotCount,
    showExilus,
    showStance,
    stanceLocked,
    conflictMap,
  })
  useSlotKeyboardNav({
    slots,
    layout: {
      normalSlotCount,
      auraSlotCount,
      showExilus,
      showStance,
      stanceLocked,
    },
  })
  const arcanes = useArcaneSlots(
    arcaneCount,
    resolveInitialArcanes(item, savedData.arcanes),
  )

  // Alternate mode: the picker sets this slot's Alternate instead of placing
  // a mod. Derived to null once the slot empties (removed, swapped away), so a
  // stale target can't swallow the next pick.
  const [alternateForRaw, setAlternateFor] = useState<SlotId | null>(null)
  const alternateFor =
    alternateForRaw && slots.placed[alternateForRaw] ? alternateForRaw : null
  // The slot the picker filters for: the Alternate's slot in alternate mode.
  const pickerSlot = alternateFor ?? slots.selected
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const startAlternatePick = (id: SlotId) => {
    setAlternateFor(id)
    // On narrow screens the picker sits below the loadout; bring it into view.
    searchPanelRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    })
  }

  // uniqueNames the picker should dim: mods mutually exclusive with one
  // already equipped (e.g. a second Serration variant).
  const conflictUniqueNames = useMemo(
    () =>
      getBlockedByConflict(
        Object.values(slots.placed)
          .filter((p) => p != null)
          .map((p) => p.mod.uniqueName),
        conflictMap,
      ),
    [slots.placed, conflictMap],
  )

  // Escape deselects the active mod/arcane slot, mirroring the
  // click-outside behavior. Skip when a dialog/popover is open (base-ui
  // closes those via its own Escape handler) or when typing in a field
  // (useHotkey's editable-target guard handles the latter).
  useHotkey(
    "Escape",
    () => {
      if (document.querySelector("[data-state='open'][role='dialog']")) return
      if (alternateFor) {
        setAlternateFor(null)
        return
      }
      slots.select(null)
      arcanes.select(null)
    },
    { preventDefault: false },
  )

  // ─── Rank hotkey (single owner) ─────────────────────────────────────
  // One window listener for `-`/`+`, instead of one per slot/arcane card.
  // Cards report which one the pointer is over via RankHoverProvider; this
  // owner ranks `hovered ?? selected mod`. Routing through a single target is
  // what fixes the multi-fire: a selected slot and a separately hovered slot
  // used to each rank on one keypress. Arcanes rank on hover only (no
  // selection fallback), preserving the prior per-card behavior.
  const hoveredRankRef = useRef<RankHoverTarget | null>(null)
  const rankHover = useMemo<RankHoverApi>(
    () => ({
      set: (target) => {
        hoveredRankRef.current = target
      },
      clear: (target) => {
        if (
          hoveredRankRef.current &&
          rankTargetsEqual(hoveredRankRef.current, target)
        ) {
          hoveredRankRef.current = null
        }
      },
    }),
    [],
  )
  useRankHotkey({
    enabled: true,
    onDelta: (delta) => {
      const hovered = hoveredRankRef.current
      if (hovered?.kind === "alternate") {
        const alt = slots.placed[hovered.id]?.alternate
        if (alt) slots.setAlternateRank(hovered.id, alt.rank + delta)
        return
      }
      if (hovered?.kind === "mod") {
        const placed = slots.placed[hovered.id]
        if (placed) slots.setRank(hovered.id, placed.rank + delta)
        return
      }
      if (hovered?.kind === "arcane") {
        const placed = arcanes.placed[hovered.index]
        if (placed) arcanes.setRank(hovered.index, placed.rank + delta)
        return
      }
      // Nothing hovered → act on the selected mod slot (keyboard-nav path).
      if (slots.selected) {
        const placed = slots.placed[slots.selected]
        if (placed) slots.setRank(slots.selected, placed.rank + delta)
      }
    },
  })

  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const [buildName, setBuildName] = useState(
    () =>
      cachedShared?.buildName ??
      localDraft?.buildName ??
      existingBuild?.name ??
      draft?.buildName ??
      item.name,
  )

  const publish = usePublishSettings({
    visibility: existingBuild?.visibility ?? "PUBLIC",
    organizationId: existingBuild?.organization?.id ?? null,
    hideAuthor: existingBuild?.hideAuthor ?? false,
  })

  const { data: myOrgs } = useQuery({
    ...myOrgsQuery(),
    enabled: !!session?.user && publish.dialogOpen,
  })
  const organizations = myOrgs?.memberships.map((m) => m.organization) ?? []

  const extras = useItemExtras({
    item,
    category,
    savedData,
    cachedShared,
    incarnonAdapterImages,
  })

  const riven = useRivenDialog({ slots, normalSlotCount, category })

  const handleModSelect = (mod: Mod) => {
    if (alternateFor) {
      if (!canBeAlternate(mod, alternateFor)) {
        toast.error(
          isRivenMod(mod)
            ? "A Riven can't be an Alternate"
            : "That mod doesn't fit this slot",
        )
        return
      }
      slots.setAlternate(alternateFor, mod)
      setAlternateFor(null)
      return
    }
    if (isRivenMod(mod)) {
      riven.openForPlacement()
      return
    }
    slots.place(mod)
  }

  // Guide state (build-wide summary/description + per-variant scope dispatch).
  // Scope resets to "build" on remount (variant switches) so switching variants
  // doesn't silently change which guide you're editing.
  const guide = useGuideState({
    initialSummary:
      cachedShared?.guideSummary ??
      localDraft?.guideSummary ??
      existingBuild?.guide?.summary ??
      "",
    initialDescription:
      cachedShared?.guideDescription ??
      localDraft?.guideDescription ??
      existingBuild?.guide?.description ??
      draft?.guideDescription ??
      "",
    variants,
    setVariants,
  })

  // Sync shared field edits into the module cache so they survive the
  // EditorShell remount on every variant switch. Per-variant fields
  // (slots/arcanes/incarnon/dc/helminth) live in the variants array;
  // this only mirrors build-wide state. One effect with a fresh patch
  // each render — React shallow-compares deps, so unchanged fields
  // no-op cheaply.
  useEffect(() => {
    writeShared({
      hasReactor: extras.hasReactor,
      zawComponents: extras.zawComponents,
      kitgunComponents: extras.kitgunComponents,
      lichBonusElement: extras.lichBonusElement,
      buildName,
      guideSummary: guide.buildSummary,
      guideDescription: guide.buildDescription,
      formaPolarities: slots.formaPolarities,
    })
    // writeShared closes over storeKey; intentionally excluded — storeKey
    // changes trigger a full EditorShell remount, not a re-sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    extras.hasReactor,
    extras.zawComponents,
    extras.kitgunComponents,
    extras.lichBonusElement,
    buildName,
    guide.buildSummary,
    guide.buildDescription,
    slots.formaPolarities,
  ])

  const history = useEditorUndo({ slots, arcanes, extras })

  // Innates, endo/forma totals, capacity, and arcane picker config — same
  // computation for view (`/builds/$slug`) and edit (`/create`).
  const {
    arcaneConfig,
    totalEndoCost,
    formaCount,
    capacity,
    capacitySharedInputs,
  } = useBuildDerived({
    item: effectiveItem,
    category,
    layout,
    slots,
    allArcanes,
    hasReactor: extras.hasReactor,
  })

  // Auto-forma planning (cheap reactive plan + heavy preview cascade). Forma is
  // build-wide in Warframe, so the planner considers every variant's slots
  // together; the computation lives in multi-variant-auto-forma.ts.
  const autoForma = useAutoFormaPlanner({
    variants,
    clampedActiveIndex,
    layout,
    slots,
    capacity,
    capacitySharedInputs,
    setVariants,
  })

  const isUpdate = !!existingBuild && existingBuild.isOwner

  const capture = makeEditorCapture({
    variants,
    clampedActiveIndex,
    slots,
    arcanes,
    extras,
    buildDescription: guide.buildDescription,
    allMods,
    allArcanes,
  })

  const save = useBuildSave({
    item,
    category,
    slug,
    existingBuild,
    isUpdate,
    storeKey,
    buildName,
    guide,
    publish,
    formaCount,
    layout,
    slots,
    arcanes,
    extras,
    variants,
    clampedActiveIndex,
    capture,
  })

  // Filled-vs-total counts per Plexus group for the picker's tab labels.
  // Aura is bundled into Integrated since it lives in that section.
  const plexusFillCounts = useMemo(() => {
    if (category !== "railjack") return undefined
    const counts = {
      battle: { filled: 0, total: 0 },
      tactical: { filled: 0, total: 0 },
      integrated: { filled: 0, total: 0 },
    }
    for (let i = 0; i < normalSlotCount; i++) {
      const group = getPlexusGroupForIndex(category, i)
      if (!group) continue
      counts[group].total += 1
      if (slots.placed[`normal-${i}` as keyof typeof slots.placed])
        counts[group].filled += 1
    }
    // The Aura slot is part of Integrated.
    for (let i = 0; i < auraSlotCount; i++) {
      counts.integrated.total += 1
      if (slots.placed[`aura-${i}` as keyof typeof slots.placed])
        counts.integrated.filled += 1
    }
    return counts
  }, [category, normalSlotCount, auraSlotCount, slots.placed])

  const { hasDraft, resetToSaved } = useDraftAutosave({
    storeKey,
    storedDraft,
    localDraft,
    isUpdate,
    capture,
    buildName,
    guide,
    slots,
    arcanes,
    extras,
    variants,
    clampedActiveIndex,
  })

  // Variant CRUD handlers. The variants state + module cache + epoch stay in
  // useEditorVariants / editor-cache; this just sequences snapshot → mutate →
  // navigate.
  const variantActions = useVariantActions({
    variants,
    setVariants,
    clampedActiveIndex,
    captureActiveSnapshot: capture.captureActiveSnapshot,
    navigate,
    bumpVariantEpoch,
    activeFormIndex,
  })

  return (
    <RankHoverProvider value={rankHover}>
      <EditorHeader
        item={item}
        category={category}
        slug={slug}
        buildSlug={buildSlug}
        categoryLabel={categoryLabel}
        totalEndoCost={totalEndoCost}
        formaCount={formaCount}
        buildName={buildName}
        displayImageName={extras.displayImageName}
        onBuildNameChange={setBuildName}
        onSave={save.handleSaveClick}
        saveStatus={save.saveStatus}
        isSignedIn={!!session?.user}
        history={{
          canUndo: history.canUndo,
          canRedo: history.canRedo,
          onUndo: history.undo,
          onRedo: history.redo,
        }}
        draft={
          hasDraft
            ? {
                label: isUpdate ? "Reset to saved" : "Discard draft",
                onReset: resetToSaved,
              }
            : undefined
        }
        settings={
          isUpdate
            ? {
                visibility: publish.visibility,
                onEdit: () => publish.setDialogOpen(true),
              }
            : undefined
        }
        onShare={save.handleShare}
      />

      <DragController slots={slots}>
        {/*
          `select-none` on the editor body prevents the browser's native
          text-selection / image-drag from hijacking pointer gestures that
          aren't on a draggable mod. The guide editor below opts back in
          via `select-text` so the markdown textarea behaves normally.
        */}
        <div className="flex flex-col gap-4 select-none">
          <KeyboardHintBanner />
          <BuildSurface
            mode="edit"
            item={effectiveItem}
            category={category}
            isCompanion={isCompanion}
            normalSlotCount={normalSlotCount}
            auraSlotCount={auraSlotCount}
            showExilus={showExilus}
            showStance={showStance}
            arcaneCount={arcaneCount}
            slots={slots}
            arcanes={arcanes}
            arcaneConfig={arcaneConfig}
            sidebarProps={{
              item,
              category,
              capacityUsed: capacity.used,
              capacityMax: capacity.max,
              autoFormaCount:
                autoForma.reactiveAutoFormaPlan?.steps.length ?? 0,
              autoFormaNoFix: autoForma.noFixFound,
              onAutoForma: autoForma.handleAutoForma,
              hasReactor: extras.hasReactor,
              onToggleReactor: () => extras.setHasReactor((v) => !v),
              shards: extras.shards,
              onSetShard: extras.setShard,
              helminth: extras.helminth,
              onSetHelminth: extras.setHelminthAt,
              zawComponents: extras.zawComponents,
              onSetZawComponents: extras.setZawComponents,
              kitgunComponents: extras.kitgunComponents,
              onSetKitgunComponents: extras.setKitgunComponents,
              lichBonusElement: extras.lichBonusElement,
              onSetLichBonusElement: extras.setLichBonusElement,
              incarnonEnabled: extras.incarnonEnabled,
              onToggleIncarnon: () => extras.setIncarnonEnabled((v) => !v),
              incarnonPerks: extras.incarnonPerks,
              onSetIncarnonPerk: extras.setIncarnonPerkAt,
              deploymentContext: extras.deploymentContext,
              onSetDeploymentContext: extras.setDeploymentContext,
              placedMods: slots.placed,
              placedArcanes: arcanes.placed,
              formAbilities,
            }}
            topBarLayout="row"
            topBar={
              <EditorVariantBar
                variants={formVariants.map((f) => f.v)}
                activeIndex={formActiveLocalIndex}
                onSwitch={(local) =>
                  variantActions.switchVariant(formVariants[local].globalIndex)
                }
                onAdd={variantActions.addVariant}
                onDuplicate={variantActions.duplicateActive}
                onDelete={variantActions.deleteActive}
                onRename={variantActions.renameActive}
                formNames={formNames}
                activeFormIndex={activeFormIndex}
                onSwitchForm={variantActions.switchForm}
              />
            }
            onEditRiven={riven.openForEdit}
            onAddAlternate={startAlternatePick}
            conflicts={conflictMap}
          />

          <div
            ref={searchPanelRef}
            className={cn(
              "bg-card scroll-mt-4 rounded-lg border p-4",
              alternateFor && "border-primary/60",
            )}
          >
            <SearchPanel
              item={item}
              category={category}
              usedModNames={slots.usedNames}
              conflictUniqueNames={conflictUniqueNames}
              onSelect={handleModSelect}
              helminth={extras.helminth}
              selectedSlotKind={
                // Plexus slot pools are governed by `selectedPlexusGroup`,
                // not by the generic aura/exilus/stance predicates — those
                // would dim every Plexus mod (none carry compatName=AURA).
                category === "railjack"
                  ? undefined
                  : pickerSlot
                    ? slotKind(pickerSlot)
                    : undefined
              }
              selectedSlot={pickerSlot}
              selectedPlexusGroup={(() => {
                if (category !== "railjack" || !pickerSlot) return undefined
                // Aura slot lives inside the Integrated tab.
                if (pickerSlot.startsWith("aura-")) return "integrated"
                const m = /^normal-(\d+)$/.exec(pickerSlot)
                if (!m) return undefined
                const idx = Number(m[1])
                return getPlexusGroupForIndex(category, idx) ?? undefined
              })()}
              plexusFillCounts={plexusFillCounts}
              selectedIsPlexusAura={
                category === "railjack" && !!pickerSlot?.startsWith("aura-")
              }
              alternateMode={
                alternateFor
                  ? {
                      forModName: slots.placed[alternateFor]!.mod.name,
                      onCancel: () => setAlternateFor(null),
                    }
                  : undefined
              }
            />
          </div>

          <div className="bg-card rounded-lg border p-4 select-text">
            <GuideEditor
              {...guide.editorProps}
              buildSlug={isUpdate ? existingBuild?.slug : undefined}
              formNames={formNames}
            />
          </div>
        </div>
      </DragController>

      <PublishDialog
        open={publish.dialogOpen}
        onOpenChange={publish.setDialogOpen}
        initialVisibility={publish.visibility}
        initialOrganizationId={publish.organizationId}
        initialHideAuthor={publish.hideAuthor}
        owner={{
          name: session?.user?.name ?? "You",
          username:
            (session?.user as { username?: string | null } | undefined)
              ?.username ?? null,
          image: session?.user?.image ?? null,
        }}
        organizations={organizations}
        confirmLabel={isUpdate ? "Update settings" : "Save build"}
        onConfirm={({
          visibility: next,
          organizationId: nextOrgId,
          hideAuthor: nextHideAuthor,
        }) => {
          publish.apply({
            visibility: next,
            organizationId: nextOrgId,
            hideAuthor: nextHideAuthor,
          })
          publish.setDialogOpen(false)
          if (!isUpdate) void save.performSave(next, nextOrgId, nextHideAuthor)
        }}
      />

      {riven.dialog}

      {autoForma.pendingHeavyPlan && (
        <AutoFormaDialog
          open={autoForma.dialogOpen}
          onOpenChange={autoForma.onDialogOpenChange}
          plan={autoForma.pendingHeavyPlan}
          variantLabels={variants.map((v) => v.label)}
          originalVariantSlots={autoForma.allVariantSlots}
          onApply={autoForma.applyPendingPlan}
        />
      )}
    </RankHoverProvider>
  )
}
