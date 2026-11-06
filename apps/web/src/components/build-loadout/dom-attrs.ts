/** Marks a mod/arcane slot; clicks outside every slot clear the selection. */
export const BUILD_SLOT_ATTR = "data-build-slot"
export const buildSlotMarker = { [BUILD_SLOT_ATTR]: true }

/** Carries a mod slot's SlotId so the drag layer can find the drop target. */
export const DROP_SLOT_ATTR = "data-drop-slot-id"

/** Wraps the loadout card's top bar (variant tabs etc.), whose controls set
 *  the selection themselves, so the card's click-outside deselect skips it. */
export const LOADOUT_TOPBAR_ATTR = "data-loadout-topbar"
export const topBarMarker = { [LOADOUT_TOPBAR_ATTR]: true }
