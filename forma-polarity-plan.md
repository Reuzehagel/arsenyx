Implementation Plan: Forma & Polarities in Arsenix
==================================================

Overview
--------
Warframes, weapons, and companions in Arsenix already use:

- `Polarity`, `Mod`, `ModSlot`, and `BuildState` in `src/lib/warframe/types.ts`
- Capacity helpers in `src/lib/warframe/capacity.ts`
- Item data from `src/lib/warframe/items.ts` (`Warframes.json`, `Primary.json`, etc.)
- Build editor UI in `src/components/build-editor/*`

Goal: wire innate polarities from item data into `BuildState`, make mod drain reflect slot polarity, and track forma usage (including swaps) in a way that fits the existing types and components.

Important: innate/default polarities DO NOT count toward a build’s forma count. Forma only represents net polarity changes relative to the original item.


Current Model Snapshot
----------------------
- `Polarity` (string union, `types.ts`)
  - `"madurai" | "vazarin" | "naramon" | "zenurik" | "unairu" | "penjaga" | "umbra" | "universal"`
- `ModSlot` (`types.ts`)
  - `id: string`
  - `type: "aura" | "exilus" | "normal" | "arcane"`
  - `innatePolarity?: Polarity`   // planned: filled from item data
  - `formaPolarity?: Polarity`    // current: set by `handleApplyForma`
  - `mod?: PlacedMod`
- `BuildState` (`types.ts`)
  - Item metadata + `hasReactor`, `auraSlot?`, `exilusSlot`, `normalSlots`, `arcaneSlots`
  - Capacity is computed via `getCapacityStatus(build)` in `capacity.ts`
- Polarity helpers (`capacity.ts`)
  - `getSlotPolarity(slot)` already resolves the effective slot polarity as `slot.formaPolarity ?? slot.innatePolarity`
  - `calculateModDrain(mod, slotPolarity?)` applies polarity bonuses/penalties to drain

This plan extends that model with:

- `BuildState.formaCount: number`
- Optional `BuildState.polarityChanges` metadata for history/analytics (not required for core UX)


Polarity Types & Sources
------------------------
Each slot may have one of the following polarities (already represented by `Polarity`):

- Madurai – `madurai` (V, damage/powers)
- Vazarin – `vazarin` (D, defensive/health/armor)
- Naramon – `naramon` (Dash, utility/misc.)
- Zenurik – `zenurik` (Scratch, warframe augments/stances)
- Unairu – `unairu` (R, melee stances)
- Penjaga – `penjaga` (Y, companion abilities)
- Umbra – `umbra` (U, anti-Sentient mods)
- Universal – `universal` (Any polarity except Umbra; stance/omni forma behavior)

Innate polarities should be derived from WFCD item data and normalized using existing utilities:

- Weapons/companions: `polarities?: string[]` on the item JSON (`Weapon` and some `Companion` entries)
- Warframes:
  - `polarities?: string[]` (8 normal mod slots)
  - `aura?: string` (aura polarity where available)
- Melee: `stancePolarity?: string` (stance slot)
- Normalization: reuse `normalizePolarity(polarity)` from `src/lib/warframe/mods.ts`

These become `ModSlot.innatePolarity` when constructing `BuildState`.


Polarity Matching Rules (Aligned with capacity.ts)
--------------------------------------------------
These rules are already implemented in `calculateModDrain` and `calculateAuraBonus`:

- Base drain: `baseDrain = mod.baseDrain + rank`
- Matching polarity (`mod.polarity === slotPolarity`):
  - Normal slots: `drain = floor(baseDrain / 2)` (approx. “50% off”)
  - Aura slot: `bonus = baseDrain * 2`
- Mismatched polarity (`mod.polarity !== slotPolarity`):
  - Normal slots: `drain = ceil(baseDrain * 1.25)` (~25% penalty)
  - Aura slot: `bonus = floor(baseDrain / 2)`
- Neutral/universal slot (`slotPolarity` absent or `"universal"`):
  - Normal slots: `drain = baseDrain`
  - Aura slot: `bonus = baseDrain`

UI behavior should reflect this:

- Matching polarity: drain number + slot polarity indicator appear GREEN.
- Mismatched polarity: drain number + slot polarity indicator appear RED.
- Neutral/universal: use the default/mod rarity colors (no highlight).

Implementation note: to avoid duplicating math in the UI, `ModSlotCard` can call `calculateModDrain`/`getSlotPolarity` and pass a `drainOverride` + `matchState` prop into `ModCard` for color decisions.


Forma & Polarity Change Logic
-----------------------------
Players may overwrite or swap polarities. Forma is only consumed when a polarity is *newly changed*, not when polarities are rearranged.

Terminology (mapped to our types):

- `innatePolarity[slot]` → `slot.innatePolarity`
- `currentPolarity[slot]` → `getSlotPolarity(slot)` (forma or innate)
- `desiredPolarity[slot]` → what the user is trying to set via the polarity selector
- `formaCount` → `BuildState.formaCount`

### 1. Overwriting a polarity
Changing a slot from its innate polarity to a different value (including “blank”/neutral) consumes forma.

Example:

- Slot A `innatePolarity = "madurai"`
- User sets slot A → neutral (no polarity)
- Result: `formaCount += 1`

### 2. Swapping polarities (NO extra forma)
If the user restores a removed polarity in a different slot, treat it as a swap rather than an additional forma.

Example:

- Item has innate `"madurai"` (slot A) and `"vazarin"` (slot B)
- User sets slot A → neutral → requires 1 forma
- User then sets slot C → `"madurai"` → this is a SWAP of the removed Madurai, no extra forma

Swap definition:

- The polarity being added already existed on the item (innate OR previously removed)
- The overall multiset of polarities on the item hasn’t introduced a brand-new value

### 3. Forma counting algorithm (build-level)
Conceptual formula:

```text
formaCount = (number of slots where effectivePolarity != innatePolarity)
             - (number of valid swaps)
```

Where:

- `effectivePolarity` is `getSlotPolarity(slot)` (forma or innate)
- A “valid swap” is a pair (or cycle) of slots whose polarities have been permuted without introducing a brand-new polarity type

Implementation approach:

- For each build recompute `formaCount` from scratch (deterministic, no drift):
  - Build a multiset of innate polarities across all slots (`innateCounts`)
  - Build a multiset of effective polarities across all slots (`effectiveCounts`)
  - Any polarity where `effectiveCounts[p] > innateCounts[p]` represents net new forma
  - Slots whose polarity differs from their own innate value but are covered by existing counts are treated as swaps
- Optionally cache per-slot flags (e.g., `slot.usedForma = boolean`) to drive UI badges.

### 4. Tracking modifications incrementally
If we want live updates as the user changes one slot:

- Maintain:
  - `removedPolarities`: multiset of innate polarities that have been “freed” by changing slots away from their innate value
  - `placedPolarities`: multiset of polarities currently placed via forma
- On change `slot X: oldPolarity → newPolarity`:
  - If `newPolarity === oldPolarity`: no-op
  - Else:
    - If `oldPolarity === slot.innatePolarity`, increment `removedPolarities[oldPolarity]`
    - If `newPolarity` matches a pending `removedPolarities` entry, decrement that entry and treat it as a swap (no net forma)
    - Otherwise, increment `placedPolarities[newPolarity]` and increase `formaCount` if this introduces net new polarity usage

For robustness and share URLs, the encoded build does **not** need the full history; it only needs current `formaPolarity` per slot and an optional `formaCount` derived by a pure function.


UI Requirements (Mapped to Components)
--------------------------------------
1. **Pre-load innate polarities**
   - Where: `createInitialBuildState` in `build-container.tsx`
   - For the selected `BrowseableItem`:
     - Map item `polarities` → `normalSlots[i].innatePolarity`
     - Map warframe `aura` → `auraSlot.innatePolarity` (where present)
     - Map melee `stancePolarity` → stance slot innate polarity (future)
   - Use `normalizePolarity` to convert strings → `Polarity`

2. **Polarity selector / Forma application**
   - Where: `ModGrid` / `ModSlotCard`
   - Behavior:
     - Right-click (or a small icon button) on a slot opens a polarity selector
     - Choosing a polarity calls `onApplyForma(slot.id, polarity)`
     - `handleApplyForma` in `build-container.tsx` updates `slot.formaPolarity`

3. **Drain color feedback**
   - Where: `ModSlotCard` → `ModCard` (`mod-card.tsx`)
   - Compute:
     - `const slotPolarity = getSlotPolarity(slot)`
     - `const drain = calculateModDrain(slot.mod, slotPolarity)`
     - `const matchState = "match" | "mismatch" | "neutral"`
   - Pass `drain` + `matchState` into `ModCard` so `ModDrainBadge` can:
     - Use green text/icon for `"match"`
     - Use red text/icon for `"mismatch"`
     - Display `drain` instead of `mod.baseDrain + rank`

4. **Forma count display**
   - Where: `ItemSidebar` or header badges in `build-container.tsx`
   - Show `formaCount` for the build:
     - “Forma: 0” for untouched builds
     - Increment visually when user applies a net new polarity
   - Optionally highlight slots that are using forma (small icon overlaid on slot frame).


Data & Encoding
---------------
- `BuildState` extensions:
  - Add `formaCount: number` (derived field; safe to omit from share URLs if recomputed)
  - Optional: `polarityChanges?: { slotId: string; from?: Polarity; to?: Polarity; at: string }[]`
- `build-codec.ts`:
  - `EncodedSlot.p` already stores `formaPolarity` (string)
  - No change required for innate polarities (they’re derived from the item)
  - If we persist `formaCount`, bump the build version and make it optional (`f?: number`) to preserve backward compatibility


Summary
-------
- Use item JSON (`polarities`, `aura`, `stancePolarity`) + `normalizePolarity` to pre-populate `ModSlot.innatePolarity` when creating a `BuildState`.
- Keep `getSlotPolarity` as the single source of truth for effective slot polarity (`formaPolarity ?? innatePolarity`).
- Compute mod drain and aura bonuses through `capacity.ts` and surface match/mismatch visually on `ModCard`.
- Track forma as *net* polarity changes rather than raw interactions; swaps and restores do not increase `formaCount`.
- Store only the minimal state needed in URLs (forma polarities + item identity) and derive `formaCount` from the build whenever possible.
