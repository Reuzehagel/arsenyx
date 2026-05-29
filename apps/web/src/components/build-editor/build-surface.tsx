import type { ReactNode } from "react"

import { cn } from "@/lib/util/utils"
import type { BrowseCategory, DetailItem } from "@/lib/warframe"

import {
  ItemSidebar,
  ItemSidebarPopover,
  type ItemSidebarProps,
} from "./item-sidebar"
import { KeyboardHintsStrip } from "./keyboard-hints"
import type { ArcaneSlotConfig } from "./layout"
import { ArcaneRow, ModGrid } from "./mod-grid"
import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState, SlotId } from "./use-build-slots"

/**
 * Shared chrome wrapping the build loadout: stacked/popover ItemSidebar +
 * main loadout card (top bar slot + ModGrid + ArcaneRow). Used by both the
 * read-only viewer (`/builds/$slug`) and the editor (`/create`); diffs flow
 * through `mode`, `embed`, and `topBarLayout`.
 *
 * Phase A of the twin-route collapse: rendering only. State setup
 * (slots/arcanes hooks, derived capacity/forma) still lives in each route.
 */
export interface BuildSurfaceProps {
  /** "view" disables interactions and skips the keyboard hints strip. */
  mode: "view" | "edit"
  /** Embed mode hides the sidebar and side margins entirely (view-only). */
  embed?: boolean
  item: DetailItem
  category: BrowseCategory
  isCompanion: boolean
  normalSlotCount: number
  auraSlotCount: number
  showExilus: boolean
  showStance: boolean
  arcaneCount: number
  slots: BuildSlotsState
  arcanes: ArcaneSlotsState
  arcaneConfig: ArcaneSlotConfig
  /** Shared sidebar props — passed to both stacked and popover variants. */
  sidebarProps: ItemSidebarProps
  /**
   * Top bar contents. `EditorVariantBar` for edit mode; `VariantTabs` (or
   * undefined) for view mode.
   */
  topBar?: ReactNode
  /**
   * Layout for the top row above the mod grid:
   * - "row": popover + topBar in a horizontal flex (edit).
   * - "centered": popover absolutely positioned, topBar centered (view, multi-variant).
   * - "popover-only": just the popover, self-start (view, single-variant).
   */
  topBarLayout: "row" | "centered" | "popover-only"
  /** Edit-only riven edit handler. */
  onEditRiven?: (slotId: SlotId) => void
}

export function BuildSurface({
  mode,
  embed = false,
  item,
  category,
  isCompanion,
  normalSlotCount,
  auraSlotCount,
  showExilus,
  showStance,
  arcaneCount,
  slots,
  arcanes,
  arcaneConfig,
  sidebarProps,
  topBar,
  topBarLayout,
  onEditRiven,
}: BuildSurfaceProps) {
  const readOnly = mode === "view"

  return (
    <div
      className={cn("flex flex-col gap-4", !embed && "xl:relative xl:block")}
    >
      {!embed && (
        <div className="flex w-full flex-col sm:hidden xl:absolute xl:top-0 xl:bottom-0 xl:left-0 xl:flex xl:w-[260px]">
          <ItemSidebar {...sidebarProps} />
        </div>
      )}

      <div
        className={cn(
          "bg-card @container/loadout flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border",
          readOnly ? "p-[clamp(0.5rem,1.5vw,1rem)]" : "p-2 sm:p-4",
          !embed && "xl:ml-[calc(260px+1rem)]",
        )}
        onClick={
          readOnly
            ? undefined
            : (e) => {
                if (!(e.target instanceof HTMLElement)) return
                if (!e.target.closest("[data-build-slot]")) {
                  slots.select(null)
                  arcanes.select(null)
                }
              }
        }
      >
        {topBarLayout === "centered" ? (
          <div className="relative flex min-h-8 items-center justify-center">
            <ItemSidebarPopover
              {...sidebarProps}
              className={cn(
                "absolute top-0 left-0",
                !embed && "hidden sm:inline-flex xl:hidden",
              )}
            />
            {topBar}
          </div>
        ) : topBarLayout === "row" ? (
          <div className="flex items-center gap-2">
            <ItemSidebarPopover
              {...sidebarProps}
              className="hidden shrink-0 sm:inline-flex xl:hidden"
            />
            {topBar && <div className="min-w-0 flex-1">{topBar}</div>}
          </div>
        ) : (
          <ItemSidebarPopover
            {...sidebarProps}
            className={cn(
              "self-start",
              !embed && "hidden sm:inline-flex xl:hidden",
            )}
          />
        )}

        <ModGrid
          item={item}
          category={category}
          isCompanion={isCompanion}
          normalSlotCount={normalSlotCount}
          auraSlotCount={auraSlotCount}
          showExilus={showExilus}
          showStance={showStance}
          slots={slots}
          {...(readOnly ? { readOnly: true } : { onEditRiven })}
          arcaneRow={
            arcaneCount > 0 ? (
              <ArcaneRow
                arcanes={arcanes}
                options={arcaneConfig.options}
                labels={arcaneConfig.labels}
                {...(readOnly && { readOnly: true })}
              />
            ) : undefined
          }
        />

        {!readOnly && <KeyboardHintsStrip />}
      </div>
    </div>
  )
}
