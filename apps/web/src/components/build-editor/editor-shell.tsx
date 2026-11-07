import type { SlotId, VariantMode } from "@arsenyx/shared/warframe/build-data"
import { getBlockedByConflict } from "@arsenyx/shared/warframe/mods"
import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { BuildSurface } from "@/components/build-loadout/build-surface"
import { DragController } from "@/components/build-loadout/drag-controller"
import {
  RankHoverProvider,
  rankTargetsEqual,
  type RankHoverApi,
  type RankHoverTarget,
} from "@/components/build-loadout/rank-hover"
import { useBuildDerived } from "@/components/build-loadout/use-build-derived"
import { authClient } from "@/lib/auth-client"
import { plexusPickerState } from "@/lib/build/plexus"
import { slotKind } from "@/lib/build/slot-id"
import { canBeAlternate } from "@/lib/build/slot-kind"
import { HOTKEYS, useHotkey } from "@/lib/hooks/hotkeys"
import { myOrgsQuery } from "@/lib/queries/org-query"
import { cn } from "@/lib/util/utils"

import { AutoFormaDialog } from "./auto-forma-dialog"
import { EditorHeader } from "./editor-header"
import { EditorVariantBar } from "./editor-variant-bar"
import { GuideEditor } from "./guide-editor"
import { KeyboardHintBanner, KeyboardHintsStrip } from "./keyboard-hints"
import { PublishDialog } from "./publish-dialog"
import { SearchPanel } from "./search-panel"
import { useAutoFormaPlanner } from "./use-auto-forma-planner"
import { useBuildSave } from "./use-build-save"
import { useEditorStore, type EditorShellSearch } from "./use-editor-store"
import { useSlotKeyboardNav } from "./use-keyboard-nav"
import { usePublishSettings } from "./use-publish-settings"
import { useRivenDialog } from "./use-riven-dialog"
import { VariantModeDialog } from "./variant-mode-dialog"

export type { EditorShellSearch }

/**
 * Composition root for the build editor: renders the editor surface over the
 * session state in `useEditorStore`, plus the save / publish / auto-forma /
 * hotkey wiring that needs the router, the session or derived capacity.
 *
 * The caller keys this on the build being edited; `onResetToSaved` asks it to
 * re-key (a fresh session) after the draft is discarded.
 */
export function EditorShell({
  search,
  onResetToSaved,
}: {
  search: EditorShellSearch
  onResetToSaved: () => void
}) {
  const navigate = useNavigate()
  // Alternate mode: the picker sets this slot's Alternate instead of placing
  // a mod. Derived to null once the slot empties (removed, swapped away), so a
  // stale target can't swallow the next pick.
  const [alternateForRaw, setAlternateFor] = useState<SlotId | null>(null)
  const store = useEditorStore({
    search,
    onResetToSaved,
    onActivate: (i) => {
      setAlternateFor(null)
      void navigate({
        to: ".",
        search: (s) => ({ ...s, v: i === 0 ? undefined : i }),
        replace: true,
      })
    },
    onAdopted: () =>
      void navigate({
        to: ".",
        search: (s) => ({ ...s, share: undefined, draft: undefined }),
        replace: true,
      }),
  })
  const {
    item,
    category,
    slug,
    buildSlug,
    existingBuild,
    allArcanes,
    conflictMap,
    storeKey,
    isUpdate,
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
    layout,
    slots,
    arcanes,
    extras,
    setExtras,
    displayImageName,
    buildName,
    setBuildName,
    guide,
    history,
    capture,
    hasDraft,
    resetToSaved,
    variantActions,
    variantMode,
    applyVariantMode,
  } = store

  // Mode switch awaiting confirmation; null = no dialog.
  const [pendingVariantMode, setPendingVariantMode] =
    useState<VariantMode | null>(null)
  const changeVariantMode = (next: VariantMode) => {
    // Confirm only once some variant has forma or shards to affect.
    const hasForma = capture
      .captureVariants()
      .some(
        (v) =>
          Object.values(v.formaPolarities ?? {}).some(Boolean) ||
          (v.shards ?? []).some(Boolean),
      )
    if (hasForma) setPendingVariantMode(next)
    else applyVariantMode(next)
  }
  const { normalSlotCount, auraSlotCount } = layout
  useSlotKeyboardNav({ slots, layout })

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

  // Escape deselects the active mod/arcane slot, mirroring click-outside.
  // An open Base UI dialog consumes its own Escape before it reaches this
  // window listener; the editable-target guard in useHotkey covers text fields.
  useHotkey(
    HOTKEYS.deselect,
    () => {
      if (alternateFor) {
        setAlternateFor(null)
        return
      }
      slots.select(null)
      arcanes.select(null)
    },
    { preventDefault: false },
  )

  // One `-`/`+` listener for the whole editor: cards report the hovered one
  // via RankHoverProvider and this ranks `hovered ?? selected mod`, so a
  // selected slot and a separately hovered one can't both rank on one press.
  // Arcanes rank on hover only.
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
  // `-`/`+` (shifted or not) step the hovered (or selected) rank.
  useHotkey(HOTKEYS.rank, (e) => {
    const delta = e.key === "-" || e.key === "_" ? -1 : 1
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
  })

  const { data: session } = authClient.useSession()

  const publish = usePublishSettings({
    visibility: existingBuild?.visibility ?? "PUBLIC",
    organizationId: existingBuild?.organization?.id ?? null,
    hideAuthor: existingBuild?.hideAuthor ?? false,
  })

  // Fetched up front (it's small) so the publish dialog never opens on a
  // false "No organizations" while the list loads.
  const { data: myOrgs, isPending: orgsPending } = useQuery({
    ...myOrgsQuery(),
    enabled: !!session?.user,
  })
  const organizations = myOrgs?.memberships.map((m) => m.organization) ?? []

  const riven = useRivenDialog({ slots, normalSlotCount, category })

  // Returns whether the pick landed, so the search keeps the query on a miss.
  const handleModSelect = (mod: Mod): boolean => {
    if (alternateFor) {
      if (!canBeAlternate(mod, alternateFor)) {
        toast.error(
          isRivenMod(mod)
            ? "A Riven can't be an Alternate"
            : "That mod doesn't fit this slot",
        )
        return false
      }
      slots.setAlternate(alternateFor, mod)
      setAlternateFor(null)
      return true
    }
    const placed = isRivenMod(mod) ? riven.openForPlacement() : slots.place(mod)
    if (!placed) {
      toast.error(`No free slot for ${mod.name}. Remove a mod first.`, {
        id: "no-free-slot",
      })
    }
    return placed
  }

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
    placed: slots.placed,
    formaPolarities: slots.formaPolarities,
    allArcanes,
    hasReactor: extras.hasReactor,
  })

  // In linked mode the planner considers every variant of the active form
  // together (they share forma).
  const autoForma = useAutoFormaPlanner({
    variantMode,
    variants,
    clampedActiveIndex,
    layout,
    slots,
    capacity,
    capacitySharedInputs,
    setVariants,
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
    displayImageName,
    clampedActiveIndex,
    capture,
  })

  return (
    <RankHoverProvider value={rankHover}>
      <EditorHeader
        item={item}
        category={category}
        slug={slug}
        buildSlug={buildSlug}
        totalEndoCost={totalEndoCost}
        formaCount={formaCount}
        buildName={buildName}
        displayImageName={displayImageName}
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
            item={effectiveItem}
            category={category}
            layout={layout}
            loadout={{
              placed: slots.placed,
              formaPolarities: slots.formaPolarities,
              arcanes: arcanes.placed,
            }}
            arcaneConfig={arcaneConfig}
            sidebarProps={{
              item,
              category,
              extras,
              capacity,
              formAbilities,
              edit: {
                update: setExtras,
                autoForma: {
                  count: autoForma.reactiveAutoFormaPlan?.steps.length ?? 0,
                  noFix: autoForma.noFixFound,
                  onClick: autoForma.handleAutoForma,
                },
              },
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
                variantMode={variantMode}
                onVariantModeChange={changeVariantMode}
              />
            }
            edit={{
              slots,
              arcanes,
              onEditRiven: riven.openForEdit,
              onAddAlternate: startAlternatePick,
            }}
            footer={<KeyboardHintsStrip className="mt-auto" />}
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
              // Plexus pools are governed by the group tabs, not the generic
              // aura/exilus/stance predicates (no Plexus mod is an AURA).
              selectedSlotKind={
                category !== "railjack" && pickerSlot
                  ? slotKind(pickerSlot)
                  : undefined
              }
              selectedSlot={pickerSlot}
              plexus={
                category === "railjack"
                  ? plexusPickerState(
                      pickerSlot,
                      slots.placed,
                      normalSlotCount,
                      auraSlotCount,
                    )
                  : undefined
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
          username: session?.user?.username ?? null,
          image: session?.user?.image ?? null,
        }}
        organizations={organizations}
        organizationsLoading={!!session?.user && orgsPending}
        settingsOnly={isUpdate}
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
          if (!isUpdate) void save.performSave(next, nextOrgId, nextHideAuthor)
        }}
      />

      {riven.dialog}

      <VariantModeDialog
        target={pendingVariantMode}
        activeLabel={variants[clampedActiveIndex]?.label ?? "this variant"}
        twinFrame={(formNames?.length ?? 0) > 1}
        onCancel={() => setPendingVariantMode(null)}
        onConfirm={() => {
          if (pendingVariantMode) applyVariantMode(pendingVariantMode)
          setPendingVariantMode(null)
        }}
      />

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
