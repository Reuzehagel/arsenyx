import { calculateFormaCount } from "@/lib/warframe/capacity"
import type {
  BuildState,
  Mod,
  PlacedMod,
  PlacedArcane,
  Polarity,
  ModSlot,
} from "@/lib/warframe/types"

import type { OverframeImportResponse } from "./types"

export interface ApplyOverframeImportWarning {
  type: "mod_not_in_compatible_list" | "mod_missing_match" | "slot_unknown"
  message: string
  details?: Record<string, unknown>
}

export interface ApplyOverframeImportResult {
  nextState: BuildState
  warnings: ApplyOverframeImportWarning[]
}

function toPlacedMod(mod: Mod, rank: number): PlacedMod {
  return {
    uniqueName: mod.uniqueName,
    name: mod.name,
    imageName: mod.imageName,
    polarity: mod.polarity,
    baseDrain: mod.baseDrain,
    fusionLimit: mod.fusionLimit,
    rank,
    rarity: mod.rarity,
    compatName: mod.compatName,
    type: mod.type,
    levelStats: mod.levelStats,
    modSet: mod.modSet,
    modSetStats: mod.modSetStats,
    isExilus: mod.isExilus,
    isUtility: mod.isUtility,
  }
}

function cloneSlot(slot: ModSlot): ModSlot {
  return { ...slot, mod: slot.mod ? { ...slot.mod } : undefined }
}

function resolveSlot(state: BuildState, slotId: string): ModSlot | null {
  if (slotId.startsWith("aura-")) return state.auraSlot ?? null
  if (slotId.startsWith("exilus-")) return state.exilusSlot ?? null
  if (slotId.startsWith("normal-")) {
    const idx = Number(slotId.slice("normal-".length))
    if (!Number.isFinite(idx) || idx < 0 || idx >= state.normalSlots.length)
      return null
    return state.normalSlots[idx] ?? null
  }
  return null
}

function writeSlot(state: BuildState, slotId: string, slot: ModSlot): void {
  if (slotId.startsWith("aura-")) {
    state.auraSlot = slot
    return
  }
  if (slotId.startsWith("exilus-")) {
    state.exilusSlot = slot
    return
  }
  if (slotId.startsWith("normal-")) {
    const idx = Number(slotId.slice("normal-".length))
    if (!Number.isFinite(idx) || idx < 0 || idx >= state.normalSlots.length)
      return
    state.normalSlots[idx] = slot
  }
}

export function applyOverframeImportToBuildState(
  prev: BuildState,
  importResult: OverframeImportResponse,
  compatibleMods: Mod[],
): ApplyOverframeImportResult {
  const warnings: ApplyOverframeImportWarning[] = []

  const next: BuildState = {
    ...prev,
    auraSlot: prev.auraSlot ? cloneSlot(prev.auraSlot) : undefined,
    exilusSlot: prev.exilusSlot ? cloneSlot(prev.exilusSlot) : undefined,
    normalSlots: prev.normalSlots.map(cloneSlot),
    arcaneSlots: prev.arcaneSlots ? [...prev.arcaneSlots] : [],
    shardSlots: prev.shardSlots ? [...prev.shardSlots] : [],
  }

  // 1) Apply slot polarities (forma)
  // Compare Overframe's reported polarity with the slot's innate polarity
  // to determine if forma was applied.
  for (const sp of importResult.slotPolarities ?? []) {
    const slot = resolveSlot(next, sp.slotId)
    if (!slot) {
      warnings.push({
        type: "slot_unknown",
        message: `Unknown slotId: ${sp.slotId}`,
        details: { slotId: sp.slotId },
      })
      continue
    }

    // Overframe polarity: the FINAL polarity of the slot (after any forma)
    // - undefined/null means "no polarity" (either innate empty or cleared via universal)
    // - A polarity value means that's what the slot shows
    const importedPolarity = sp.polarity as Polarity | undefined

    // Case 1: Overframe says "no polarity" but slot has innate
    // → This means the innate polarity was CLEARED (universal forma)
    if (!importedPolarity && slot.innatePolarity) {
      slot.formaPolarity = "universal"
      writeSlot(next, sp.slotId, slot)
      continue
    }

    // Case 2: Overframe says "no polarity" and slot has no innate
    // → No change, slot is naturally empty
    if (!importedPolarity && !slot.innatePolarity) {
      continue
    }

    // Case 3: Overframe polarity matches innate
    // → No forma needed, slot uses innate polarity
    if (importedPolarity === slot.innatePolarity) {
      continue
    }

    // Case 4: Overframe polarity differs from innate
    // → Forma was applied to change the polarity
    slot.formaPolarity = importedPolarity
    writeSlot(next, sp.slotId, slot)
  }

  // 2) Place mods
  // Build index for O(1) mod lookup by uniqueName
  const compatibleModsByName = new Map(
    compatibleMods.map((cm) => [cm.uniqueName, cm]),
  )

  for (const m of importResult.mods) {
    if (!m.matched?.uniqueName) {
      warnings.push({
        type: "mod_missing_match",
        message: `Missing WFCD match for slot ${m.slotId}`,
        details: {
          slotId: m.slotId,
          overframeId: m.overframeId,
          overframeName: m.overframeName,
        },
      })
      continue
    }

    const fullMod = compatibleModsByName.get(m.matched!.uniqueName)
    if (!fullMod) {
      warnings.push({
        type: "mod_not_in_compatible_list",
        message: `Matched mod not found in compatibleMods for slot ${m.slotId}`,
        details: { slotId: m.slotId, uniqueName: m.matched.uniqueName },
      })
      continue
    }

    const slot = resolveSlot(next, m.slotId)
    if (!slot) {
      warnings.push({
        type: "slot_unknown",
        message: `Unknown slotId: ${m.slotId}`,
        details: { slotId: m.slotId },
      })
      continue
    }

    const boundedRank = Math.max(
      0,
      Math.min(m.rank ?? 0, fullMod.fusionLimit ?? m.rank ?? 0),
    )
    slot.mod = toPlacedMod(fullMod, boundedRank)
    writeSlot(next, m.slotId, slot)
  }

  // 3) Place arcanes
  if (importResult.arcanes) {
    for (const a of importResult.arcanes) {
      if (!a.matched?.uniqueName) continue
      const idx = a.slotIndex
      if (idx < 0 || idx >= next.arcaneSlots.length) {
        warnings.push({
          type: "slot_unknown",
          message: `Arcane slot index ${idx} out of range (max ${next.arcaneSlots.length - 1})`,
          details: { slotIndex: idx, arcaneName: a.matched.name },
        })
        continue
      }
      const placed: PlacedArcane = {
        uniqueName: a.matched.uniqueName,
        name: a.matched.name,
        imageName: a.matched.imageName,
        rank: a.rank,
        rarity: a.matched.rarity,
      }
      next.arcaneSlots[idx] = placed
    }
  }

  // 4) Compute formaCount if not provided
  const computedFormaCount = calculateFormaCount(
    next.normalSlots,
    next.auraSlot,
    next.exilusSlot,
  )
  next.formaCount = importResult.formaCount ?? computedFormaCount

  return { nextState: next, warnings }
}
