import { useMemo, useState } from "react"

import {
  getVariants,
  isSyntheticVariant,
  pickPerVariantData,
  selectVariant,
} from "@/lib/codec/build-codec-adapter"
import { applyFormPolarities, deriveFormAxis } from "@/lib/form-axis"
import type { SavedBuildData, SavedVariant } from "@/lib/queries/build-query"
import type { DetailItem } from "@/lib/warframe"

import { editorCache, type SharedEditorOverrides } from "./editor-cache"

export type SetVariants = (
  next: SavedVariant[] | ((prev: SavedVariant[]) => SavedVariant[]),
) => void

/**
 * The editor's variants array (kept in lockstep with the module cache so it
 * survives variant-switch remounts), the twin-frame form axis derived from
 * it, the active variant's mount-frozen data slice, and the build-wide
 * shared overrides read/write pair.
 */
export function useEditorVariants({
  storeKey,
  savedDataAll,
  item,
  activeVariantIndex,
}: {
  storeKey: string
  savedDataAll: SavedBuildData
  item: DetailItem
  activeVariantIndex: number
}) {
  // Track the variants list as mutable state so add/duplicate/delete can
  // mutate it before save without round-tripping through the URL.
  // EditorShell is re-keyed on variant switch, which would normally reset
  // useState. The module-level cache (keyed by storeKey) preserves the
  // in-progress variants array across those remounts.
  const [variants, _setVariants] = useState<SavedVariant[]>(() => {
    if (editorCache.current && editorCache.current.key === storeKey) {
      return editorCache.current.data
    }
    const initial = getVariants(savedDataAll)
    // Fresh twin-frame build (Sirius & Orion): seed one variant per form so
    // both forms are present and switchable from the start. Only when the
    // build is brand-new (a single synthetic variant) — saved/shared builds
    // already carry their own variants.
    const forms = item.forms
    const seeded =
      forms &&
      forms.length > 1 &&
      initial.length === 1 &&
      isSyntheticVariant(initial[0])
        ? // Each form's first variant keeps the synthetic "Main" label — the
          // form name lives on the form toggle, so labeling the variant by form
          // would just duplicate it. Distinct ids so they don't collide.
          forms.map((_form, i) => ({
            ...initial[0],
            id: i === 0 ? initial[0].id : `form${i}`,
            formIndex: i,
          }))
        : initial
    // No cache write here: a render that Suspense discards (a child loading
    // on first mount) would leave the cache set, and the retry render would
    // then read `localDraft` as a remount and drop the restored draft's name,
    // guide text and toast. EditorShell's shared-sync effect seeds the cache
    // on commit instead.
    return seeded
  })
  const setVariants: SetVariants = (next) => {
    // Write the module cache SYNCHRONOUSLY rather than inside the React state
    // updater. A structural mutation (add/duplicate/delete) calls setVariants
    // and then navigate() + bumpVariantEpoch() in the same tick, which changes
    // EditorShell's key and unmounts this fiber. React discards a queued
    // updater on an unmounting fiber, so a cache write performed *inside* the
    // updater is silently lost and the remount re-reads stale data. Computing
    // the value here and writing the cache eagerly makes it survive the
    // remount. Base off the cache (kept in lockstep with `variants`) so
    // multiple setVariants in one tick — e.g. commitRename() then
    // duplicateActive() — compose correctly instead of stranding the last one.
    const base =
      editorCache.current?.key === storeKey
        ? editorCache.current.data
        : variants
    const value = typeof next === "function" ? next(base) : next
    // Preserve `shared` — setVariants only owns the variants array.
    const sharedSlot =
      editorCache.current?.key === storeKey
        ? editorCache.current.shared
        : undefined
    editorCache.current = { key: storeKey, data: value, shared: sharedSlot }
    _setVariants(value)
  }
  const clampedActiveIndex = Math.min(
    Math.max(0, activeVariantIndex),
    variants.length - 1,
  )

  // Twin-frames (Sirius & Orion): the active variant picks which switchable
  // form it builds, and the variant bar shows only that form's variants (each
  // form has its own MAX_VARIANTS budget). Read live from `variants` (not the
  // mount-frozen savedData) so changing a variant's form updates the ability
  // strip and tabs immediately. Shared with the viewer via `deriveFormAxis`;
  // no-op for normal frames (activeFormIndex 0, formVariants = all variants).
  const formAxis = useMemo(
    () => deriveFormAxis(item, variants, clampedActiveIndex),
    [item, variants, clampedActiveIndex],
  )
  const { isTwin, formPolarities, formAuraPolarity, formExilusPolarity } =
    formAxis
  // Polarity-overridden view of the item (active form's innate polarities) for
  // the layout, slot grid, and forma/capacity maths — see `applyFormPolarities`.
  const effectiveItem = useMemo(
    () =>
      applyFormPolarities(item, {
        isTwin,
        formPolarities,
        formAuraPolarity,
        formExilusPolarity,
      }),
    [isTwin, item, formPolarities, formAuraPolarity, formExilusPolarity],
  )

  // Slice projected for this variant — feeds the slot/arcane hooks. Reads
  // from the in-memory `variants` state (which may contain unsaved
  // add/duplicate/rename edits) rather than re-deriving from server data.
  //
  // PRECONDITION: EditorShell is re-keyed on `${build}-${v}` in
  // routes/create.tsx, so this useMemo only runs at mount (the right
  // semantics). If that key is ever dropped/changed, the empty-deps
  // memo will silently freeze on first-mount data.
  const savedData: SavedBuildData = useMemo(() => {
    const active = variants[clampedActiveIndex]
    if (!active) return selectVariant(savedDataAll, clampedActiveIndex)
    // No fallback to savedDataAll for per-variant fields. savedDataAll's
    // top-level mirrors the saved-active variant; falling back to it would
    // pre-fill a freshly-added blank variant with the previous variant's
    // helminth/incarnon/dc. Downstream useState initializers supply their
    // own defaults (isInnateIncarnon, DEFAULT_DEPLOYMENT_CONTEXT, empty
    // helminth) when these are undefined.
    return {
      ...savedDataAll,
      slots: active.slots,
      arcanes: active.arcanes,
      // The variant's own shards (getVariants already resolved copy-on-load for
      // legacy builds when seeding the variants array, so this is always set).
      shards: active.shards ?? [],
      // Route per-variant fields through the single choke point (same as
      // getVariants/selectVariant) so a future field can't be silently dropped
      // here — it copies from `active` with no fallback to savedDataAll's mirror.
      ...pickPerVariantData(active),
    }
    // Read once at mount — EditorShell re-keys on switch, so reading
    // stale variants[] state during this mount is the desired behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build-wide shared field overrides (not in variants[]). Persist
  // across variant-switch remounts via the cache so unsaved edits to
  // shards/forma/reactor/lich/zaw/buildName aren't lost.
  const cachedShared =
    editorCache.current?.key === storeKey
      ? editorCache.current.shared
      : undefined
  const writeShared = (patch: Partial<SharedEditorOverrides>) => {
    if (!editorCache.current || editorCache.current.key !== storeKey) {
      // Key mismatch (or empty cache) means the previous bucket belongs to a
      // different build — do NOT carry its shared overrides forward, that
      // would leak forma/shards/buildName/etc. across builds.
      editorCache.current = {
        key: storeKey,
        data: variants,
        shared: { ...patch },
      }
      return
    }
    editorCache.current.shared = {
      ...(editorCache.current.shared ?? {}),
      ...patch,
    }
  }

  return {
    variants,
    setVariants,
    clampedActiveIndex,
    formAxis,
    effectiveItem,
    savedData,
    cachedShared,
    writeShared,
  }
}
