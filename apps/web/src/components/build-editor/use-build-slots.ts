import { useCallback, useMemo, useState } from "react";

import type { Mod, Polarity } from "@arsenyx/shared/warframe/types";

import type { ModSlotKind } from "./mod-slot";

export type SlotId = "aura" | "exilus" | `normal-${number}`;

export interface PlacedMod {
  mod: Mod;
  rank: number;
}

export function isAuraMod(mod: Mod): boolean {
  return mod.compatName?.toUpperCase() === "AURA";
}

export function isExilusCompatible(mod: Mod): boolean {
  return Boolean(mod.isExilus || mod.isUtility);
}

function slotKind(id: SlotId): ModSlotKind {
  if (id === "aura") return "aura";
  if (id === "exilus") return "exilus";
  return "normal";
}

function canPlaceIn(mod: Mod, id: SlotId): boolean {
  switch (slotKind(id)) {
    case "aura":
      return isAuraMod(mod);
    case "exilus":
      return !isAuraMod(mod) && isExilusCompatible(mod);
    case "normal":
      return !isAuraMod(mod);
  }
}

function maxRank(mod: Mod): number {
  return mod.fusionLimit ?? 0;
}

export interface BuildSlotsState {
  placed: Partial<Record<SlotId, PlacedMod>>;
  usedNames: Set<string>;
  selected: SlotId | null;
  formaPolarities: Partial<Record<SlotId, Polarity>>;
  place: (mod: Mod) => void;
  remove: (id: SlotId) => void;
  select: (id: SlotId | null) => void;
  setRank: (id: SlotId, rank: number) => void;
  /**
   * Apply a forma to the slot. Pass `"universal"` to explicitly clear the
   * slot (overrides innate). Pass `null` to revert to innate (no forma).
   */
  setForma: (id: SlotId, polarity: Polarity | null) => void;
}

export function useBuildSlots(normalSlotCount: number): BuildSlotsState {
  const [placed, setPlaced] = useState<Partial<Record<SlotId, PlacedMod>>>({});
  const [selected, setSelected] = useState<SlotId | null>(null);
  const [formaPolarities, setFormaPolarities] = useState<
    Partial<Record<SlotId, Polarity>>
  >({});

  const place = useCallback(
    (mod: Mod) => {
      setPlaced((prev) => {
        if (Object.values(prev).some((p) => p?.mod.name === mod.name)) {
          return prev;
        }

        if (selected && canPlaceIn(mod, selected)) {
          setSelected(null);
          return { ...prev, [selected]: { mod, rank: maxRank(mod) } };
        }

        const tryIds: SlotId[] = isAuraMod(mod)
          ? ["aura"]
          : isExilusCompatible(mod)
            ? [
                "exilus",
                ...Array.from(
                  { length: normalSlotCount },
                  (_, i) => `normal-${i}` as SlotId,
                ),
              ]
            : Array.from(
                { length: normalSlotCount },
                (_, i) => `normal-${i}` as SlotId,
              );

        for (const id of tryIds) {
          if (!prev[id] && canPlaceIn(mod, id)) {
            return { ...prev, [id]: { mod, rank: maxRank(mod) } };
          }
        }
        return prev;
      });
    },
    [normalSlotCount, selected],
  );

  const remove = useCallback((id: SlotId) => {
    setPlaced((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const select = useCallback((id: SlotId | null) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

  const setRank = useCallback((id: SlotId, rank: number) => {
    setPlaced((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const clamped = Math.max(0, Math.min(maxRank(cur.mod), rank));
      if (clamped === cur.rank) return prev;
      return { ...prev, [id]: { ...cur, rank: clamped } };
    });
  }, []);

  const setForma = useCallback((id: SlotId, polarity: Polarity | null) => {
    setFormaPolarities((prev) => {
      if (polarity === null) {
        if (!(id in prev)) return prev;
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: polarity };
    });
  }, []);

  const usedNames = useMemo(
    () => new Set(Object.values(placed).map((p) => p!.mod.name)),
    [placed],
  );

  return {
    placed,
    usedNames,
    selected,
    formaPolarities,
    place,
    remove,
    select,
    setRank,
    setForma,
  };
}
