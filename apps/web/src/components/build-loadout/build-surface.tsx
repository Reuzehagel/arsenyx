import type { ModConflictMap } from "@arsenyx/shared/warframe/mods"
import { hasModCapacity } from "@arsenyx/shared/warframe/slot-layout"
import type { BrowseCategory } from "@arsenyx/shared/warframe/types"
import type { ReactNode } from "react"

import type { ArcaneSlotConfig, BuildLayout } from "@/lib/build/layout"
import type { Loadout } from "@/lib/build/loadout"
import type { DetailItem } from "@/lib/catalog"
import { cn } from "@/lib/util/utils"

import { BUILD_SLOT_ATTR, LOADOUT_TOPBAR_ATTR, topBarMarker } from "./dom-attrs"
import {
  ItemSidebar,
  ItemSidebarPopover,
  type ItemSidebarProps,
} from "./item-sidebar"
import type { LoadoutEdit } from "./loadout-edit"
import { ModConflictBanner } from "./mod-conflict-banner"
import { ArcaneRow, ModGrid } from "./mod-grid"

/**
 * Shared chrome around a build loadout: stacked/popover ItemSidebar + the
 * loadout card (top bar + ModGrid + ArcaneRow). The read-only viewer passes no
 * `edit`; the editor passes its slot/arcane handles.
 */
interface BuildSurfaceProps {
  /** Hides the sidebar and side margins entirely (view-only embed). */
  embed?: boolean
  /** The form-overlaid item (see `useFormAxis`). */
  item: DetailItem
  category: BrowseCategory
  layout: BuildLayout
  loadout: Loadout
  arcaneConfig: ArcaneSlotConfig
  /** Passed to both the stacked and the popover sidebar; the placed mods and
   *  arcanes come from `loadout`. */
  sidebarProps: Omit<ItemSidebarProps, "placedMods" | "placedArcanes">
  topBar?: ReactNode
  /**
   * - "row": popover + topBar in a horizontal flex (edit).
   * - "centered": popover pinned left, topBar centered (view, multi-variant).
   * - "popover-only": just the popover (view, single-variant).
   */
  topBarLayout: "row" | "centered" | "popover-only"
  edit?: LoadoutEdit
  /** Pinned to the bottom of the loadout card (the editor's hint strip). */
  footer?: ReactNode
  /** When supplied, a banner warns about mutually exclusive mods. */
  conflicts?: ModConflictMap
}

export function BuildSurface({
  embed = false,
  item,
  category,
  layout,
  loadout,
  arcaneConfig,
  sidebarProps: sidebarBase,
  topBar,
  topBarLayout,
  edit,
  footer,
  conflicts,
}: BuildSurfaceProps) {
  const sidebarProps: ItemSidebarProps = {
    ...sidebarBase,
    placedMods: loadout.placed,
    placedArcanes: loadout.arcanes,
  }
  // Capacity-less categories (Operators) have a short sidebar that holds their
  // main config (Focus School, Amp), so it stays inline at every width
  // instead of collapsing into the Stats popover.
  const modded = hasModCapacity(category)

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        !embed &&
          (modded
            ? "xl:relative xl:block"
            : "xl:grid xl:grid-cols-[260px_minmax(0,1fr)] xl:items-stretch xl:gap-4"),
      )}
    >
      {!embed && (
        <div
          className={cn(
            "flex w-full flex-col xl:w-[260px]",
            modded &&
              "sm:hidden xl:absolute xl:top-0 xl:bottom-0 xl:left-0 xl:flex",
          )}
        >
          <ItemSidebar {...sidebarProps} />
        </div>
      )}

      <div
        className={cn(
          "bg-card @container/loadout flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border",
          edit ? "p-2 sm:p-4" : "p-[clamp(0.5rem,1.5vw,1rem)]",
          !embed && modded && "xl:ml-[calc(260px+1rem)]",
        )}
        onClick={
          edit
            ? (e) => {
                if (!(e.target instanceof HTMLElement)) return
                // The top bar's controls (e.g. a variant switch) set the
                // selection themselves.
                if (
                  !e.target.closest(
                    `[${BUILD_SLOT_ATTR}], [${LOADOUT_TOPBAR_ATTR}]`,
                  )
                ) {
                  edit.slots.select(null)
                  edit.arcanes.select(null)
                }
              }
            : undefined
        }
      >
        {topBarLayout === "centered" ? (
          // Symmetric padding the width of the pinned Stats button keeps
          // narrow tab sets centered without sliding a tab under it.
          <div className="relative flex min-h-8 items-center justify-center sm:px-24 xl:px-0">
            {modded && (
              <ItemSidebarPopover
                {...sidebarProps}
                className={cn(
                  "absolute top-0 left-0",
                  !embed && "hidden sm:inline-flex xl:hidden",
                )}
              />
            )}
            <div {...topBarMarker} className="contents">
              {topBar}
            </div>
          </div>
        ) : topBarLayout === "row" ? (
          <div className="flex items-center gap-2">
            {modded && (
              <ItemSidebarPopover
                {...sidebarProps}
                className="hidden shrink-0 sm:inline-flex xl:hidden"
              />
            )}
            {topBar && (
              <div {...topBarMarker} className="min-w-0 flex-1">
                {topBar}
              </div>
            )}
          </div>
        ) : (
          modded && (
            <ItemSidebarPopover
              {...sidebarProps}
              className={cn(
                "self-start",
                !embed && "hidden sm:inline-flex xl:hidden",
              )}
            />
          )
        )}

        {conflicts && (
          <ModConflictBanner placed={loadout.placed} conflicts={conflicts} />
        )}

        <ModGrid
          item={item}
          category={category}
          layout={layout}
          placed={loadout.placed}
          formaPolarities={loadout.formaPolarities}
          edit={edit}
          arcaneRow={
            layout.arcaneCount > 0 ? (
              <ArcaneRow
                arcanes={loadout.arcanes}
                options={arcaneConfig.options}
                labels={arcaneConfig.labels}
                edit={edit?.arcanes}
              />
            ) : undefined
          }
        />

        {footer}
      </div>
    </div>
  )
}
