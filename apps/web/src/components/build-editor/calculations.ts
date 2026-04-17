import type { Mod, Polarity } from "@arsenyx/shared/warframe/types";

import type { PlacedMod, SlotId } from "./use-build-slots";

const ENDO_PER_RANK: Record<Mod["rarity"], number> = {
  Common: 10,
  Uncommon: 15,
  Rare: 20,
  Legendary: 30,
  Peculiar: 15,
  Riven: 20,
  Amalgam: 20,
  Galvanized: 20,
};

export function calculateModEndoCost(placed: PlacedMod): number {
  const base = ENDO_PER_RANK[placed.mod.rarity] ?? 15;
  let total = 0;
  for (let i = 0; i < placed.rank; i++) {
    total += base * Math.pow(2, i);
  }
  return total;
}

export function calculateTotalEndoCost(
  placed: Partial<Record<SlotId, PlacedMod>>,
): number {
  let total = 0;
  for (const p of Object.values(placed)) {
    if (p) total += calculateModEndoCost(p);
  }
  return total;
}

function effectivePolarity(
  innate: Polarity | undefined,
  forma: Polarity | undefined,
): Polarity | undefined {
  if (forma !== undefined) return forma === "universal" ? undefined : forma;
  return innate;
}

function singleSlotForma(
  innate: Polarity | undefined,
  forma: Polarity | undefined,
): number {
  return innate !== effectivePolarity(innate, forma) ? 1 : 0;
}

interface NormalSlotEntry {
  innate: Polarity | undefined;
  forma: Polarity | undefined;
}

function groupForma(slots: NormalSlotEntry[]): number {
  const innateCounts: Partial<Record<Polarity, number>> = {};
  const effectiveCounts: Partial<Record<Polarity, number>> = {};

  for (const { innate, forma } of slots) {
    const eff = effectivePolarity(innate, forma);
    if (innate) innateCounts[innate] = (innateCounts[innate] ?? 0) + 1;
    if (eff) effectiveCounts[eff] = (effectiveCounts[eff] ?? 0) + 1;
  }

  const all = new Set<Polarity>([
    ...(Object.keys(innateCounts) as Polarity[]),
    ...(Object.keys(effectiveCounts) as Polarity[]),
  ]);

  let additions = 0;
  let removals = 0;
  for (const p of all) {
    const a = innateCounts[p] ?? 0;
    const b = effectiveCounts[p] ?? 0;
    if (b > a) additions += b - a;
    else if (a > b) removals += a - b;
  }
  return Math.max(additions, removals);
}

function effectiveDrainForMod(
  mod: Mod,
  rank: number,
  slotPolarity: Polarity | undefined,
): number {
  const base = mod.baseDrain + rank;
  if (!slotPolarity || slotPolarity === "universal") return base;
  if (slotPolarity === "any") {
    return mod.polarity === "umbra" ? base : Math.ceil(base / 2);
  }
  if (mod.polarity === slotPolarity) return Math.ceil(base / 2);
  return Math.ceil(base * 1.25);
}

function auraBonusForMod(
  mod: Mod,
  rank: number,
  slotPolarity: Polarity | undefined,
): number {
  const base = Math.abs(mod.baseDrain) + rank;
  if (!slotPolarity || slotPolarity === "universal") return base;
  if (slotPolarity === "any") {
    return mod.polarity === "umbra" ? base : base * 2;
  }
  if (mod.polarity === slotPolarity) return base * 2;
  return Math.floor(base / 2);
}

export interface CapacityInput {
  placed: Partial<Record<SlotId, PlacedMod>>;
  formaPolarities: Partial<Record<SlotId, Polarity>>;
  auraInnate?: Polarity;
  normalInnates: (Polarity | undefined)[];
  hasReactor: boolean;
  maxLevelCap?: number;
}

export interface CapacityResult {
  used: number;
  max: number;
  base: number;
  auraBonus: number;
}

function effPol(
  innate: Polarity | undefined,
  forma: Polarity | undefined,
): Polarity | undefined {
  if (forma !== undefined) return forma === "universal" ? undefined : forma;
  return innate;
}

export function calculateCapacity(input: CapacityInput): CapacityResult {
  const {
    placed,
    formaPolarities,
    auraInnate,
    normalInnates,
    hasReactor,
    maxLevelCap,
  } = input;

  const level = maxLevelCap ?? 30;
  const base = hasReactor ? level * 2 : level;

  let auraBonus = 0;
  const auraPlaced = placed.aura;
  if (auraPlaced) {
    auraBonus += auraBonusForMod(
      auraPlaced.mod,
      auraPlaced.rank,
      effPol(auraInnate, formaPolarities.aura),
    );
  }

  let used = 0;
  const exilus = placed.exilus;
  if (exilus) {
    used += effectiveDrainForMod(
      exilus.mod,
      exilus.rank,
      effPol(undefined, formaPolarities.exilus),
    );
  }
  for (let i = 0; i < normalInnates.length; i++) {
    const id = `normal-${i}` as SlotId;
    const p = placed[id];
    if (!p) continue;
    used += effectiveDrainForMod(
      p.mod,
      p.rank,
      effPol(normalInnates[i], formaPolarities[id]),
    );
  }

  return { used, max: base + auraBonus, base, auraBonus };
}

export interface FormaCountInput {
  auraInnate?: Polarity;
  exilusInnate?: Polarity;
  normalInnates: (Polarity | undefined)[];
  formaPolarities: Partial<Record<SlotId, Polarity>>;
}

export function calculateFormaCount(input: FormaCountInput): number {
  const { auraInnate, exilusInnate, normalInnates, formaPolarities } = input;
  let total = 0;

  total += singleSlotForma(auraInnate, formaPolarities.aura);
  total += singleSlotForma(exilusInnate, formaPolarities.exilus);

  const normalSlots: NormalSlotEntry[] = normalInnates.map((innate, i) => ({
    innate,
    forma: formaPolarities[`normal-${i}` as SlotId],
  }));
  total += groupForma(normalSlots);

  return total;
}
