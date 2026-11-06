import type { SlotId } from "@arsenyx/shared/warframe/build-data"

export type ModSlotKind = "normal" | "aura" | "exilus" | "stance"

export function slotKind(id: SlotId): ModSlotKind {
  if (id.startsWith("aura-")) return "aura"
  if (id === "exilus") return "exilus"
  if (id === "stance") return "stance"
  return "normal"
}

/** The N of an `aura-N` / `normal-N` slot; -1 for exilus and stance. */
export function slotIndex(id: SlotId): number {
  const dash = id.indexOf("-")
  return dash < 0 ? -1 : Number(id.slice(dash + 1))
}
