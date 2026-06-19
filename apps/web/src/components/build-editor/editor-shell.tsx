import {
  decodeBuildDoc,
  encodeBuild,
  encodeBuildDoc,
} from "@arsenyx/shared/warframe/build-codec"
import {
  projectVariant,
  type BuildDoc,
} from "@arsenyx/shared/warframe/build-doc"
import {
  getIncarnonGenesisImage,
  isInnateIncarnon,
} from "@arsenyx/shared/warframe/incarnon-data"
import {
  defaultKitgunComponents,
  isKitgunChamber,
  type KitgunComponents,
  kitgunGripsFor,
} from "@arsenyx/shared/warframe/kitgun-data"
import { getBlockedByConflict } from "@arsenyx/shared/warframe/mods"
import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import {
  DEFAULT_DEPLOYMENT_CONTEXT,
  type DeploymentContext,
  type LichBonusElement,
  type Mod,
  type Polarity,
} from "@arsenyx/shared/warframe/types"
import {
  isZawStrike,
  ZAW_DEFAULT_GRIP,
  ZAW_DEFAULT_LINK,
} from "@arsenyx/shared/warframe/zaw-data"
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EditorHeader } from "@/components/create-editor/editor-header"
import { SearchPanel } from "@/components/create-editor/search-panel"
import { useRivenDialog } from "@/components/create-editor/use-riven-dialog"
import { authClient } from "@/lib/auth-client"
import {
  buildStateToSavedData,
  getVariants,
  isSyntheticVariant,
  normalizeBuildData,
  pickPerVariantData,
  savedDataToBuildState,
  selectVariant,
  stripPersistedImages,
  SYNTHETIC_VARIANT_ID,
  SYNTHETIC_VARIANT_LABEL,
} from "@/lib/codec/build-codec-adapter"
import {
  clearEditorDraft,
  loadEditorDraft,
  saveEditorDraft,
  type EditorDraftPayload,
} from "@/lib/editor-draft"
import { applyFormPolarities, deriveFormAxis } from "@/lib/form-axis"
import { collectGuideRefs } from "@/lib/guide-refs"
import { useHotkey } from "@/lib/hooks/hotkeys"
import { consumeDraft } from "@/lib/import-draft"
import { arcanesQuery } from "@/lib/queries/arcanes-query"
import {
  buildQuery,
  type SavedBuildData,
  type SavedVariant,
} from "@/lib/queries/build-query"
import {
  helminthQuery,
  type HelminthAbility,
} from "@/lib/queries/helminth-query"
import { itemQuery } from "@/lib/queries/item-query"
import { modConflictsQuery } from "@/lib/queries/mod-conflicts-query"
import { modsQuery } from "@/lib/queries/mods-query"
import { myOrgsQuery } from "@/lib/queries/org-query"
import { padShards, type PlacedShard } from "@/lib/shards"
import { apiErrorMessage, apiFetch } from "@/lib/util/api-client"
import { copyToClipboard } from "@/lib/util/clipboard"
import { EXTERNAL_LINKS } from "@/lib/util/constants"
import {
  hasShownDonationNudge,
  markDonationNudgeShown,
} from "@/lib/util/donation-nudge"
import { getCategoryLabel, type BrowseCategory } from "@/lib/warframe"

import { AutoFormaDialog } from "./auto-forma-dialog"
import { useBuildDerived, getBuildLayout } from "./build-derived"
import { BuildSurface } from "./build-surface"
import { DragController } from "./drag-controller"
import { EditorVariantBar } from "./editor-variant-bar"
import { GuideEditor } from "./guide-editor"
import { KeyboardHintBanner } from "./keyboard-hints"
import { getPlexusGroupForIndex } from "./layout"
import { resolveInitialArcanes } from "./layout"
import { PublishDialog, type PublishVisibility } from "./publish-dialog"
import {
  RankHoverProvider,
  rankTargetsEqual,
  type RankHoverApi,
  type RankHoverTarget,
} from "./rank-hover"
import { useArcaneSlots, type PlacedArcane } from "./use-arcane-slots"
import { useAutoFormaPlanner } from "./use-auto-forma-planner"
import {
  useBuildSlots,
  slotKind,
  type PlacedMod,
  type SlotId,
} from "./use-build-slots"
import { useEditorHistory } from "./use-editor-history"
import { useGuideState } from "./use-guide-state"
import { useSlotKeyboardNav } from "./use-keyboard-nav"
import { usePublishSettings } from "./use-publish-settings"
import { useRankHotkey } from "./use-rank-hotkey"
import { useVariantActions } from "./use-variant-actions"

// ─── In-memory editor cache ─────────────────────────────────────────────────
//
// Survives EditorShell remounts (the editor is re-keyed on variant switch
// so per-variant hooks can re-initialize from the new variant's data).
// Single-entry cache keyed by buildSlug — replaced when editing a different
// build. Routes that mount EditorShell are responsible for calling
// `resetEditorCache()` on unmount so navigation away from /create doesn't
// leave stale variants in memory.

type SharedEditorOverrides = {
  hasReactor?: boolean
  zawComponents?: { grip: string; link: string } | undefined
  kitgunComponents?: KitgunComponents | undefined
  lichBonusElement?: LichBonusElement | null
  formaPolarities?: Partial<Record<string, Polarity>>
  buildName?: string
  guideSummary?: string
  guideDescription?: string
}

let cachedVariants: {
  key: string
  data: SavedVariant[]
  shared?: SharedEditorOverrides
} | null = null

// One undo/redo step: the full mutable editor state for the active variant
// plus the build-wide fields. Excludes the build name and guide prose (those
// keep their native textarea undo) and the variants array / active index
// (variant structure isn't undoable — a switch remounts and resets history).
type EditorHistorySnapshot = {
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  arcanes: (PlacedArcane | null)[]
  shards: (PlacedShard | null)[]
  hasReactor: boolean
  helminth: Record<number, HelminthAbility>
  zawComponents: { grip: string; link: string } | undefined
  kitgunComponents: KitgunComponents | undefined
  lichBonusElement: LichBonusElement | null
  incarnonEnabled: boolean
  incarnonPerks: (string | null)[]
  deploymentContext: DeploymentContext
}

// Field-wise reference equality. Sound because every snapshot field is a value
// or an immutably-replaced reference — never mutated in place.
function snapshotsEqual(
  a: EditorHistorySnapshot,
  b: EditorHistorySnapshot,
): boolean {
  return (Object.keys(a) as (keyof EditorHistorySnapshot)[]).every((k) =>
    Object.is(a[k], b[k]),
  )
}

export function resetEditorCache() {
  cachedVariants = null
}

// ─── Variant structural epoch ───────────────────────────────────────────────
//
// EditorShell is re-keyed on `${build}-${v}` (see create.tsx) so the
// per-variant hooks re-initialize from the projected variant on a switch. But
// `?v` is an *index*, and deleting a non-last active variant slides the next
// variant into that same index — `?v` is unchanged, no remount fires, and the
// slot/arcane hooks keep showing the deleted variant's data.
//
// This monotonic counter closes that gap: structural mutations (add / delete /
// duplicate) bump it, CreatePage subscribes via useSyncExternalStore and folds
// it into the key, so any structural change forces a clean remount regardless
// of whether the index moved. A module-level store (not React state) because
// the value has to be readable by CreatePage, which is a sibling above the
// component that mutates it.
let variantEpoch = 0
const variantEpochListeners = new Set<() => void>()

export function subscribeVariantEpoch(onChange: () => void): () => void {
  variantEpochListeners.add(onChange)
  return () => variantEpochListeners.delete(onChange)
}

export function getVariantEpoch(): number {
  return variantEpoch
}

function bumpVariantEpoch() {
  variantEpoch += 1
  for (const listener of variantEpochListeners) listener()
}

export interface EditorShellSearch {
  item: string
  category: BrowseCategory
  build?: string
  draft?: string
  share?: string
  /** Active variant index for multi-variant builds. 0 (or undefined) =
   *  first variant. */
  v?: number
}

export function EditorShell({ search }: { search: EditorShellSearch }) {
  const {
    item: slug,
    category,
    build: buildSlug,
    draft: draftId,
    share: shareEncoded,
    v: activeVariantIndex = 0,
  } = search
  const { data: item } = useSuspenseQuery(itemQuery(category, slug))
  const { data: existingBuild } = useQuery({
    ...buildQuery(buildSlug ?? ""),
    enabled: !!buildSlug,
  })
  const { data: allMods } = useSuspenseQuery(modsQuery)
  const { data: allArcanes } = useSuspenseQuery(arcanesQuery)
  const { data: helminthAbilities } = useSuspenseQuery(helminthQuery)
  const { data: conflictMap } = useSuspenseQuery(modConflictsQuery)
  const [draft] = useState(() => consumeDraft(draftId))
  const [shareHydrated] = useState(() => {
    if (!shareEncoded) return null
    // decodeBuildDoc handles both v1 (wrapped as single-variant doc) and v2.
    const doc = decodeBuildDoc(shareEncoded)
    if (doc) {
      const activeIdx = 0
      const activeState = projectVariant(doc, activeIdx)
      const { data: activeData } = buildStateToSavedData(
        activeState,
        allMods,
        allArcanes,
      )
      // `formIndex` isn't carried through BuildState, so lift it off the
      // decoded variant directly onto the top-level mirror. `activeData.shards`
      // already holds the active variant's set (decodeBuildDoc seeds each
      // variant's shards — per-variant on new links, copy-on-load on old ones).
      const withForm = {
        ...activeData,
        formIndex: doc.variants[activeIdx].formIndex,
      }
      if (doc.variants.length === 1) return { data: withForm }
      const savedVariants: SavedVariant[] = doc.variants.map((v, i) => {
        const state = projectVariant(doc, i)
        const { data } = buildStateToSavedData(state, allMods, allArcanes)
        return {
          id: v.id,
          label: v.label,
          slots: data.slots ?? {},
          arcanes: data.arcanes ?? [],
          shards: data.shards ?? [],
          ...pickPerVariantData(data),
          formIndex: v.formIndex,
          guideSummary: v.guideSummary,
          guideDescription: v.guideDescription,
        }
      })
      return { data: { ...withForm, variants: savedVariants } }
    }
    return null
  })
  // Identity for the in-memory cache and the localStorage draft bucket.
  // `buildSlug` for an existing build; item+category for a new one (the
  // EditorShell isn't re-keyed on item change, but the lookup must still
  // distinguish two consecutive new-build sessions on different items).
  const storeKey = buildSlug ?? `__new_build__:${category}:${slug}`

  // Whether a draft exists on disk for this build, read once at mount. Null
  // when a share link or import is driving hydration — we don't surface a
  // stale draft as "active" in that case.
  const [storedDraft] = useState<EditorDraftPayload | null>(() =>
    shareEncoded || draftId ? null : loadEditorDraft(storeKey),
  )
  // Hydrate the editor from the draft only on a *fresh* mount. A variant-switch
  // remount keeps the in-memory cache, so re-applying the draft (and re-firing
  // the restore toast) would be wrong — but the draft still exists on disk, so
  // `storedDraft` stays non-null to keep the badge visible.
  const [localDraft] = useState<EditorDraftPayload | null>(() =>
    cachedVariants && cachedVariants.key === storeKey ? null : storedDraft,
  )

  // Full normalized saved data (all variants intact); used when persisting.
  const savedDataAll: SavedBuildData = useMemo(() => {
    if (draft) return draft.data
    // A restored draft overrides the saved build — that's the whole point.
    // The "Draft restored" toast + reset control keep it from being haunted.
    // Normalize like a saved build: the draft persisted with mod/arcane
    // `imageName` stripped (see stripPersistedImages), so re-resolve images
    // from the catalog — otherwise restored mods render with a blank "?" tile.
    if (localDraft)
      return normalizeBuildData(
        localDraft.buildData,
        allMods,
        allArcanes,
        helminthAbilities,
      )
    if (existingBuild)
      return normalizeBuildData(
        existingBuild.buildData,
        allMods,
        allArcanes,
        helminthAbilities,
      )
    if (shareHydrated) return shareHydrated.data
    return {} as SavedBuildData
  }, [
    draft,
    localDraft,
    existingBuild,
    shareHydrated,
    allMods,
    allArcanes,
    helminthAbilities,
  ])

  // Track the variants list as mutable state so add/duplicate/delete can
  // mutate it before save without round-tripping through the URL.
  // EditorShell is re-keyed on variant switch, which would normally reset
  // useState. The module-level cache (keyed by storeKey) preserves the
  // in-progress variants array across those remounts.
  const [variants, _setVariants] = useState<SavedVariant[]>(() => {
    if (cachedVariants && cachedVariants.key === storeKey) {
      return cachedVariants.data
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
    cachedVariants = { key: storeKey, data: seeded }
    return seeded
  })
  const setVariants = (
    next: SavedVariant[] | ((prev: SavedVariant[]) => SavedVariant[]),
  ) => {
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
      cachedVariants?.key === storeKey ? cachedVariants.data : variants
    const value =
      typeof next === "function"
        ? (next as (p: SavedVariant[]) => SavedVariant[])(base)
        : next
    // Preserve `shared` — setVariants only owns the variants array.
    const sharedSlot =
      cachedVariants?.key === storeKey ? cachedVariants.shared : undefined
    cachedVariants = { key: storeKey, data: value, shared: sharedSlot }
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
  const {
    isTwin,
    activeFormIndex,
    formAbilities,
    helminthAllowed,
    formNames,
    formVariants,
    formActiveLocalIndex,
    formPolarities,
    formAuraPolarity,
    formExilusPolarity,
  } = useMemo(
    () => deriveFormAxis(item, variants, clampedActiveIndex),
    [item, variants, clampedActiveIndex],
  )
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

  // Slice projected for this variant — feeds the existing slot/arcane
  // hooks below. Reads from the in-memory `variants` state (which may
  // contain unsaved add/duplicate/rename edits) rather than re-deriving
  // from server data.
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
    cachedVariants?.key === storeKey ? cachedVariants.shared : undefined
  const writeShared = (patch: Partial<SharedEditorOverrides>) => {
    if (!cachedVariants || cachedVariants.key !== storeKey) {
      // Key mismatch (or empty cache) means the previous bucket belongs to a
      // different build — do NOT carry its shared overrides forward, that
      // would leak forma/shards/buildName/etc. across builds.
      cachedVariants = {
        key: storeKey,
        data: variants,
        shared: { ...patch },
      }
      return
    }
    cachedVariants.shared = { ...(cachedVariants.shared ?? {}), ...patch }
  }

  const categoryLabel = getCategoryLabel(category)

  const layout = useMemo(
    () => getBuildLayout(effectiveItem, category),
    [effectiveItem, category],
  )
  const {
    isCompanion,
    normalSlotCount,
    auraSlotCount,
    arcaneCount,
    showExilus,
    showStance,
    stanceLocked,
  } = layout
  const slots = useBuildSlots(normalSlotCount, {
    placed: savedData.slots,
    // Forma is build-wide (shared across variants); use the cached
    // override so unsaved forma edits survive variant switches.
    formaPolarities: cachedShared?.formaPolarities ?? savedData.formaPolarities,
    auraSlotCount,
    showExilus,
    showStance,
    stanceLocked,
    conflictMap,
  })
  useSlotKeyboardNav({
    slots,
    layout: {
      normalSlotCount,
      auraSlotCount,
      showExilus,
      showStance,
      stanceLocked,
    },
  })
  const arcanes = useArcaneSlots(
    arcaneCount,
    resolveInitialArcanes(item, savedData.arcanes),
  )

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

  // Escape deselects the active mod/arcane slot, mirroring the
  // click-outside behavior. Skip when a dialog/popover is open (base-ui
  // closes those via its own Escape handler) or when typing in a field
  // (useHotkey's editable-target guard handles the latter).
  useHotkey(
    "Escape",
    () => {
      if (document.querySelector("[data-state='open'][role='dialog']")) return
      slots.select(null)
      arcanes.select(null)
    },
    { preventDefault: false },
  )

  // ─── Rank hotkey (single owner) ─────────────────────────────────────
  // One window listener for `-`/`+`, instead of one per slot/arcane card.
  // Cards report which one the pointer is over via RankHoverProvider; this
  // owner ranks `hovered ?? selected mod`. Routing through a single target is
  // what fixes the multi-fire: a selected slot and a separately hovered slot
  // used to each rank on one keypress. Arcanes rank on hover only (no
  // selection fallback), preserving the prior per-card behavior.
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
  useRankHotkey({
    enabled: true,
    onDelta: (delta) => {
      const hovered = hoveredRankRef.current
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
    },
  })

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()

  const [buildName, setBuildName] = useState(
    () =>
      cachedShared?.buildName ??
      localDraft?.buildName ??
      existingBuild?.name ??
      draft?.buildName ??
      item.name,
  )
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving">("idle")
  // Whether an autosaved draft is currently overriding the saved build. Seeded
  // from `storedDraft` (which survives variant-switch remounts, where
  // localDraft is intentionally null) and kept in sync by the autosave effect.
  const [hasDraft, setHasDraft] = useState(() => storedDraft !== null)

  const publish = usePublishSettings({
    visibility: existingBuild?.visibility ?? "PUBLIC",
    organizationId: existingBuild?.organization?.id ?? null,
    hideAuthor: existingBuild?.hideAuthor ?? false,
  })

  const { data: myOrgs } = useQuery({
    ...myOrgsQuery(),
    enabled: !!session?.user && publish.dialogOpen,
  })
  const organizations = myOrgs?.memberships.map((m) => m.organization) ?? []

  const [hasReactor, setHasReactor] = useState(
    () => cachedShared?.hasReactor ?? savedData.hasReactor ?? true,
  )

  // Shards are per-variant. Like slots/arcanes, the live `shards` state seeds
  // from the active variant (mount-frozen `savedData`, copy-on-load resolved)
  // and is captured back into the variants array on switch/save — so the
  // remount a variant/form switch triggers re-hydrates the right set.
  const [shards, setShards] = useState<(PlacedShard | null)[]>(() =>
    padShards(savedData.shards),
  )
  const setShard = (i: number, s: PlacedShard | null) => {
    setShards((prev) => {
      const next = [...prev]
      next[i] = s
      return next
    })
  }

  const riven = useRivenDialog({ slots, normalSlotCount, category })

  const handleModSelect = (mod: Mod) => {
    if (isRivenMod(mod)) {
      riven.openForPlacement()
      return
    }
    slots.place(mod)
  }

  // Guide state (build-wide summary/description + per-variant scope dispatch).
  // Scope resets to "build" on remount (variant switches) so switching variants
  // doesn't silently change which guide you're editing.
  const guide = useGuideState({
    initialSummary:
      cachedShared?.guideSummary ??
      localDraft?.guideSummary ??
      existingBuild?.guide?.summary ??
      "",
    initialDescription:
      cachedShared?.guideDescription ??
      localDraft?.guideDescription ??
      existingBuild?.guide?.description ??
      draft?.guideDescription ??
      "",
    variants,
    setVariants,
  })

  const [zawComponents, setZawComponents] = useState<
    { grip: string; link: string } | undefined
  >(() => {
    if (cachedShared && "zawComponents" in cachedShared) {
      return cachedShared.zawComponents
    }
    if (savedData.zawComponents) return savedData.zawComponents
    if (isZawStrike(item.name)) {
      return { grip: ZAW_DEFAULT_GRIP, link: ZAW_DEFAULT_LINK }
    }
    return undefined
  })

  useEffect(() => {
    setZawComponents((prev) => {
      if (isZawStrike(item.name)) {
        return prev ?? { grip: ZAW_DEFAULT_GRIP, link: ZAW_DEFAULT_LINK }
      }
      return undefined
    })
  }, [item.name])

  // Kitgun chambers surface as primary/secondary items; the grip's class is
  // fixed by which one the build is anchored to (mirrors the zaw block above).
  const kitgunClass = category === "primary" ? "primary" : "secondary"
  const [kitgunComponents, setKitgunComponents] = useState<
    KitgunComponents | undefined
  >(() => {
    if (cachedShared && "kitgunComponents" in cachedShared) {
      return cachedShared.kitgunComponents
    }
    if (savedData.kitgunComponents) return savedData.kitgunComponents
    if (isKitgunChamber(item.uniqueName)) {
      return defaultKitgunComponents(kitgunClass)
    }
    return undefined
  })

  useEffect(() => {
    setKitgunComponents((prev) => {
      if (!isKitgunChamber(item.uniqueName)) return undefined
      // Re-seed when there's no prior selection, or when the prior grip no
      // longer fits this chamber's class. Primary/secondary variants of one
      // chamber share a uniqueName and `create.tsx` doesn't re-key EditorShell
      // on the swap, so a stale primary grip (e.g. Brash) could otherwise
      // linger on a secondary chamber. Loaders are class-agnostic.
      const gripFits =
        prev && kitgunGripsFor(kitgunClass).some((g) => g.name === prev.grip)
      return gripFits ? prev : defaultKitgunComponents(kitgunClass)
    })
  }, [item.uniqueName, kitgunClass])

  const [lichBonusElement, setLichBonusElement] =
    useState<LichBonusElement | null>(
      () =>
        cachedShared?.lichBonusElement ?? savedData.lichBonusElement ?? null,
    )

  // Innate incarnons (no separate Genesis adapter) default-on; Steel Path
  // Circuit weapons require installing the adapter, so default-off.
  const [incarnonEnabled, setIncarnonEnabled] = useState(
    () => savedData.incarnonEnabled ?? isInnateIncarnon(item.name),
  )
  const [incarnonPerks, setIncarnonPerks] = useState<(string | null)[]>(
    () => savedData.incarnonPerks ?? [],
  )

  const [deploymentContext, setDeploymentContext] = useState<DeploymentContext>(
    () => savedData.deploymentContext ?? DEFAULT_DEPLOYMENT_CONTEXT,
  )

  // Sync shared field edits into the module cache so they survive the
  // EditorShell remount on every variant switch. Per-variant fields
  // (slots/arcanes/incarnon/dc/helminth) live in the variants array;
  // this only mirrors build-wide state. One effect with a fresh patch
  // each render — React shallow-compares deps, so unchanged fields
  // no-op cheaply.
  useEffect(() => {
    writeShared({
      hasReactor,
      zawComponents,
      kitgunComponents,
      lichBonusElement,
      buildName,
      guideSummary: guide.buildSummary,
      guideDescription: guide.buildDescription,
      formaPolarities: slots.formaPolarities,
    })
    // writeShared closes over storeKey; intentionally excluded — storeKey
    // changes trigger a full EditorShell remount, not a re-sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasReactor,
    zawComponents,
    kitgunComponents,
    lichBonusElement,
    buildName,
    guide.buildSummary,
    guide.buildDescription,
    slots.formaPolarities,
  ])
  const setIncarnonPerkAt = (tierIndex: number, perk: string | null) => {
    setIncarnonPerks((prev) => {
      const next = [...prev]
      while (next.length <= tierIndex) next.push(null)
      next[tierIndex] = perk
      return next
    })
  }

  const displayImageName = incarnonEnabled
    ? (getIncarnonGenesisImage(item.name) ?? item.imageName ?? undefined)
    : (item.imageName ?? undefined)

  const [helminth, setHelminth] = useState<Record<number, HelminthAbility>>(
    () => savedData.helminth ?? {},
  )
  const setHelminthAt = (i: number, ab: HelminthAbility | null) => {
    setHelminth((prev) => {
      if (!ab) {
        const { [i]: _removed, ...rest } = prev
        return rest
      }
      // Only one subsumed ability per build.
      return { [i]: ab }
    })
  }

  // ─── Undo / redo ────────────────────────────────────────────────────
  // Reads the live editor state into a snapshot, and writes one back through
  // every setter. The recording effect below feeds `commit`; the hotkeys and
  // header buttons drive `undo`/`redo`.
  const captureHistorySnapshot = (): EditorHistorySnapshot => ({
    placed: slots.placed,
    formaPolarities: slots.formaPolarities,
    arcanes: arcanes.placed,
    shards,
    hasReactor,
    helminth,
    zawComponents,
    kitgunComponents,
    lichBonusElement,
    incarnonEnabled,
    incarnonPerks,
    deploymentContext,
  })

  const applyHistorySnapshot = (s: EditorHistorySnapshot) => {
    slots.setPlaced(s.placed)
    slots.setFormaPolarities(s.formaPolarities)
    arcanes.setPlaced(s.arcanes)
    setShards(s.shards)
    setHasReactor(s.hasReactor)
    setHelminth(s.helminth)
    setZawComponents(s.zawComponents)
    setKitgunComponents(s.kitgunComponents)
    setLichBonusElement(s.lichBonusElement)
    setIncarnonEnabled(s.incarnonEnabled)
    setIncarnonPerks(s.incarnonPerks)
    setDeploymentContext(s.deploymentContext)
  }

  // Seed the baseline from the mount snapshot (lazy init runs once). Every
  // field is an immutable value/reference owned by a setState, so a real edit
  // always swaps at least one reference — a field-wise `Object.is` sweep tells
  // a genuine change apart from a no-op re-record without deep-walking mods.
  const [historyInitial] = useState(captureHistorySnapshot)
  const history = useEditorHistory(
    historyInitial,
    applyHistorySnapshot,
    snapshotsEqual,
  )

  // Record edits into history, debounced so a burst (held +/-, drag, rapid
  // clicks) collapses to one undo step. Mirrors the autosave effect's dep list
  // minus the text/structure fields the snapshot intentionally omits.
  const historyInitializedRef = useRef(false)
  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true
      return
    }
    const snapshot = captureHistorySnapshot()
    // An undo/redo apply lands here too — consume it so it isn't re-recorded.
    if (history.consumeApply(snapshot)) return
    const handle = window.setTimeout(() => history.commit(snapshot), 500)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slots.placed,
    slots.formaPolarities,
    arcanes.placed,
    shards,
    hasReactor,
    helminth,
    zawComponents,
    kitgunComponents,
    lichBonusElement,
    incarnonEnabled,
    incarnonPerks,
    deploymentContext,
  ])

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y on Windows) redoes. Left to
  // fire only outside text fields (allowInEditable defaults false), so the name
  // and guide inputs keep their native per-keystroke undo.
  useHotkey("mod+z", () => history.undo())
  useHotkey("mod+shift+z", () => history.redo())
  useHotkey("mod+y", () => history.redo())

  // Innates, endo/forma totals, capacity, and arcane picker config — same
  // computation for view (`/builds/$slug`) and edit (`/create`).
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
    slots,
    allArcanes,
    hasReactor,
  })

  // Auto-forma planning (cheap reactive plan + heavy preview cascade). Forma is
  // build-wide in Warframe, so the planner considers every variant's slots
  // together; the computation lives in multi-variant-auto-forma.ts.
  const autoForma = useAutoFormaPlanner({
    variants,
    clampedActiveIndex,
    layout,
    slots,
    capacity,
    capacitySharedInputs,
    setVariants,
  })

  const isUpdate = !!existingBuild && existingBuild.isOwner

  const handleShare = () => {
    const state = savedDataToBuildState({
      item: {
        uniqueName: item.uniqueName,
        name: item.name,
        imageName: item.imageName ?? undefined,
      },
      category,
      buildName: buildName.trim() || item.name,
      hasReactor,
      slots: slots.placed,
      formaPolarities: slots.formaPolarities,
      arcanes: arcanes.placed,
      shards,
      helminth,
      zawComponents,
      kitgunComponents,
      lichBonusElement: lichBonusElement ?? undefined,
      incarnonEnabled,
      incarnonPerks,
      deploymentContext,
      normalSlotCount,
      auraSlotCount,
      showStance,
    })
    let encoded: string
    const activeSnapshot = captureActiveSnapshot()
    const allVariants = variants.map((v, i) =>
      i === clampedActiveIndex ? activeSnapshot : v,
    )
    // A single twin-frame variant on a non-primary form still needs the v2
    // doc encoder — v1 can't carry `formIndex`.
    const needsDoc =
      allVariants.length > 1 || Boolean(allVariants[0]?.formIndex)
    if (needsDoc) {
      // Build a BuildDoc that mirrors the current editor state: shared
      // fields from `state`, per-variant data from the in-memory variants
      // array (with the active variant's slice replaced by the live
      // editor state so unsaved tweaks make it into the share URL).
      const doc: BuildDoc = {
        itemUniqueName: state.itemUniqueName,
        itemName: state.itemName,
        itemCategory: state.itemCategory,
        itemImageName: state.itemImageName,
        hasReactor: state.hasReactor,
        helminthAbility: state.helminthAbility,
        zawComponents: state.zawComponents,
        kitgunComponents: state.kitgunComponents,
        lichBonusElement: state.lichBonusElement,
        buildName: state.buildName,
        variants: allVariants.map((sv) => {
          // Project each saved variant into a BuildVariant shape. The
          // expensive slot reconstruction (ModSlot[]) is reused via
          // savedDataToBuildState by overlaying the variant's slots
          // onto the same shared editor state.
          const variantState = savedDataToBuildState({
            item: {
              uniqueName: state.itemUniqueName,
              name: state.itemName,
              imageName: state.itemImageName,
            },
            category,
            buildName: state.buildName,
            hasReactor,
            slots: sv.slots,
            // Forma polarities are build-wide in Warframe (shared across
            // variants), so passing the active variant's value to every
            // per-variant projection is intentional.
            formaPolarities: slots.formaPolarities,
            arcanes: sv.arcanes,
            // Per-variant shards: the captured active variant carries the live
            // set; others carry their own (copy-on-load resolved at load).
            shards: sv.shards ?? [],
            helminth,
            zawComponents,
            kitgunComponents,
            lichBonusElement: lichBonusElement ?? undefined,
            incarnonEnabled: sv.incarnonEnabled ?? incarnonEnabled,
            incarnonPerks: sv.incarnonPerks ?? incarnonPerks,
            deploymentContext: sv.deploymentContext ?? deploymentContext,
            normalSlotCount,
            auraSlotCount,
            showStance,
          })
          return {
            id: sv.id,
            label: sv.label,
            auraSlots: variantState.auraSlots,
            exilusSlot: variantState.exilusSlot,
            stanceSlot: variantState.stanceSlot,
            normalSlots: variantState.normalSlots,
            arcaneSlots: variantState.arcaneSlots,
            shardSlots: variantState.shardSlots,
            incarnonEnabled: variantState.incarnonEnabled,
            incarnonPerks: variantState.incarnonPerks,
            deploymentContext: variantState.deploymentContext,
            formIndex: sv.formIndex,
          }
        }),
      }
      encoded = encodeBuildDoc(doc, clampedActiveIndex)
    } else {
      encoded = encodeBuild(state)
    }
    const url = `${window.location.origin}/create?item=${encodeURIComponent(slug)}&category=${encodeURIComponent(category)}&share=${encodeURIComponent(encoded)}`
    void copyToClipboard(url, "Build link copied")
  }

  const handleSaveClick = () => {
    // Guard re-entry: the Save button is disabled while saving, but the
    // Ctrl/Cmd+S hotkey bypasses that, so a double-press could fire two
    // concurrent saves (duplicate POST, double navigate/toast).
    if (saveStatus === "saving") return
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    if (!isUpdate) {
      publish.setDialogOpen(true)
      return
    }
    void performSave(
      publish.visibility,
      publish.organizationId,
      publish.hideAuthor,
    )
  }

  // Ctrl/Cmd+S saves from anywhere in the editor, including while a text
  // field (name, guide) has focus — hence allowInEditable. preventDefault
  // (the default) stops the browser's own Save dialog.
  useHotkey("mod+s", handleSaveClick, { allowInEditable: true })

  const performSave = async (
    nextVisibility: PublishVisibility,
    nextOrganizationId: string | null,
    nextHideAuthor: boolean,
  ) => {
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    publish.setDialogOpen(false)
    setSaveStatus("saving")
    try {
      const body = {
        name: buildName.trim() || item.name,
        visibility: nextVisibility,
        organizationId: nextOrganizationId,
        hideAuthor: nextHideAuthor,
        // Strip denormalized mod/arcane/helminth imageName before persisting —
        // images are re-resolved by uniqueName at render time (viewer via
        // image-map.json, editor via the catalog), so storing them just bloats
        // the row and rots across image-scheme changes.
        buildData: captureBuildData(),
        // Forma count is a projection of buildData + the item's innate
        // polarities (catalog). Compute it here — the only place with the
        // catalog — so the list endpoint can show/sort it without shipping
        // buildData. `catalogVersion` stamps which catalog snapshot it was
        // computed against (server stamps the calc version).
        formaCount,
        catalogVersion: __DATA_VERSION__,
        guide: {
          summary: guide.buildSummary.trim() || null,
          description: guide.buildDescription.trim() || null,
        },
        // itemImageName tracks the incarnon toggle (and any future image
        // change), so update it on PATCH too. The identity fields
        // (itemUniqueName / itemCategory / itemName) stay create-only.
        itemImageName: displayImageName ?? null,
        ...(isUpdate
          ? {}
          : {
              itemUniqueName: item.uniqueName,
              itemCategory: category,
              itemName: item.name,
            }),
      }
      const path = isUpdate ? `/builds/${existingBuild!.slug}` : `/builds`
      const { slug } = await apiFetch<{ id: string; slug: string }>(path, {
        method: isUpdate ? "PATCH" : "POST",
        json: body,
      })
      await queryClient.invalidateQueries({ queryKey: ["build", slug] })
      // Drop the in-memory variants cache so a follow-up edit re-hydrates
      // from the persisted server state rather than stale local edits, and
      // clear the autosaved draft — the saved state is now the source of truth.
      cachedVariants = null
      clearEditorDraft(storeKey)
      toast.success(isUpdate ? "Build saved" : "Build published")
      // Moment-of-value donation ask: only after a *new* build is published
      // (not on edits), and only ever once per browser — whether the user
      // tips, dismisses, or ignores it. Kept as a dismissible toast, never a
      // modal/banner, so it stays gentle.
      if (!isUpdate && !hasShownDonationNudge()) {
        markDonationNudgeShown()
        toast(
          <div className="flex flex-col gap-2">
            <div>
              <p className="font-medium">Thanks for building with Arsenyx</p>
              <p className="text-muted-foreground text-sm">
                It&apos;s free and runs on ~$5/mo of server costs. If it&apos;s
                useful to you, a small tip keeps it online.
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <a
                href={EXTERNAL_LINKS.koFi}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                Support on Ko-fi
              </a>
            </div>
          </div>,
          // Explicit close button — dismissal shouldn't rely on the user
          // knowing they can swipe a toast away.
          { duration: 12000, closeButton: true },
        )
      }
      navigate({ to: "/builds/$slug", params: { slug } })
    } catch (err) {
      // Re-enable the Save button and surface the failure as a toast with a
      // Retry action. This is the only place a save can fail (API down), so
      // there's no longer a need for the inline error text in the header.
      setSaveStatus("idle")
      toast.error(apiErrorMessage(err, "Couldn't save the build"), {
        // A failed save is important enough to stay until the user acts on it,
        // rather than auto-dismissing after a few seconds.
        duration: Infinity,
        action: {
          label: "Retry",
          onClick: () =>
            void performSave(
              nextVisibility,
              nextOrganizationId,
              nextHideAuthor,
            ),
        },
      })
    }
  }

  // Filled-vs-total counts per Plexus group for the picker's tab labels.
  // Aura is bundled into Integrated since it lives in that section.
  const plexusFillCounts = useMemo(() => {
    if (category !== "railjack") return undefined
    const counts = {
      battle: { filled: 0, total: 0 },
      tactical: { filled: 0, total: 0 },
      integrated: { filled: 0, total: 0 },
    }
    for (let i = 0; i < normalSlotCount; i++) {
      const group = getPlexusGroupForIndex(category, i)
      if (!group) continue
      counts[group].total += 1
      if (slots.placed[`normal-${i}` as keyof typeof slots.placed])
        counts[group].filled += 1
    }
    // The Aura slot is part of Integrated.
    for (let i = 0; i < auraSlotCount; i++) {
      counts.integrated.total += 1
      if (slots.placed[`aura-${i}` as keyof typeof slots.placed])
        counts.integrated.filled += 1
    }
    return counts
  }, [category, normalSlotCount, auraSlotCount, slots.placed])

  // ─── Variant management ────────────────────────────────────────────
  // Switching captures the in-progress edits into `variants` and updates
  // the URL ?v=N — the remount on the new key reinitializes hooks from
  // the new variant's data. Unsaved per-variant edits live in `variants`
  // until the next save.
  const captureActiveSnapshot = (): SavedVariant => {
    const existing = variants[clampedActiveIndex]
    return {
      id: existing?.id ?? SYNTHETIC_VARIANT_ID,
      label: existing?.label ?? SYNTHETIC_VARIANT_LABEL,
      slots: slots.placed,
      arcanes: arcanes.placed,
      // Shards are per-variant — capture the live set into this variant.
      shards,
      ...pickPerVariantData({
        helminth,
        incarnonEnabled,
        incarnonPerks,
        deploymentContext,
        // formIndex is a variant property (set via the form selector), not
        // live editor state — preserve it from the existing variant.
        formIndex: existing?.formIndex,
      }),
      // Per-variant guide fields are owned by `variants[i]` directly
      // (GuideEditor writes through setVariants). Preserve them on
      // snapshot so a save while editing build-wide doesn't wipe them.
      guideSummary: existing?.guideSummary,
      guideDescription: existing?.guideDescription,
    }
  }

  // The full persistable buildData for the current editor state, with the
  // active variant's live edits folded back into the variants array. Shared
  // by the save path and the autosave draft writer so the two can't drift.
  const captureBuildData = (): SavedBuildData => {
    const activeSnapshot = captureActiveSnapshot()
    const nextVariants = variants.map((v, i) =>
      i === clampedActiveIndex ? activeSnapshot : v,
    )
    // Snapshot every mod/arcane referenced from guide text (build-wide +
    // per-variant) so the viewer renders hover cards without the catalog —
    // see lib/guide-refs.ts.
    const guideRefs = collectGuideRefs(
      [guide.buildDescription, ...nextVariants.map((v) => v.guideDescription)],
      allMods,
      allArcanes,
    )
    return stripPersistedImages({
      version: 1,
      slots: slots.placed,
      formaPolarities: slots.formaPolarities,
      arcanes: arcanes.placed,
      // Top-level `shards` mirrors the active variant (per-variant sets live in
      // `variants[i].shards`). Legacy `formShards` is intentionally not emitted.
      shards,
      hasReactor,
      helminth,
      zawComponents,
      kitgunComponents,
      lichBonusElement: lichBonusElement ?? undefined,
      incarnonEnabled,
      incarnonPerks,
      deploymentContext,
      guideRefs,
      // Emit `variants` whenever there's more than one OR the single
      // remaining variant has a user-assigned label/id — otherwise the
      // synthetic placeholder from getVariants() would silently overwrite
      // the user's label after delete-down-to-one.
      ...((nextVariants.length > 1 || !isSyntheticVariant(nextVariants[0])) && {
        variants: nextVariants,
      }),
    })
  }

  // ─── Autosave draft ─────────────────────────────────────────────────
  // Debounce the full editor state to localStorage so a refresh doesn't wipe
  // unsaved work. The first run is the hydration render (no user edit yet), so
  // skip it; after that, any change writes a draft. The draft is cleared on a
  // successful save and by the explicit Reset/Discard control. We intentionally
  // don't auto-clear on a manual revert-to-saved: that needed a baseline
  // snapshot that was wrong after a variant-switch remount (it got re-seeded to
  // the dirty state, so it could delete a live draft) — the visible badge plus
  // Reset/Discard cover bailing out instead.
  const draftInitializedRef = useRef(false)

  useEffect(() => {
    if (!draftInitializedRef.current) {
      draftInitializedRef.current = true
      return
    }
    const handle = window.setTimeout(() => {
      // Capture + serialize inside the debounce so a burst of edits costs one
      // snapshot per idle window, not one per keystroke.
      saveEditorDraft(storeKey, {
        buildData: captureBuildData(),
        buildName,
        guideSummary: guide.buildSummary,
        guideDescription: guide.buildDescription,
      })
      setHasDraft(true)
    }, 600)
    return () => window.clearTimeout(handle)
    // Re-run on any edit. captureBuildData reads the values below; listing them
    // keeps the snapshot current without re-binding the helper in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    buildName,
    guide.buildSummary,
    guide.buildDescription,
    slots.placed,
    slots.formaPolarities,
    arcanes.placed,
    shards,
    hasReactor,
    helminth,
    zawComponents,
    kitgunComponents,
    lichBonusElement,
    incarnonEnabled,
    incarnonPerks,
    deploymentContext,
    variants,
    clampedActiveIndex,
  ])

  // Clear the draft and reload so the editor re-hydrates from the saved build
  // (or a blank new build). A reload is the simplest way to reset the live
  // slot/arcane hooks, which only initialize at mount.
  const resetToSaved = () => {
    clearEditorDraft(storeKey)
    resetEditorCache()
    window.location.reload()
  }

  // Tell the user once, on the mount where we actually restored a draft, that
  // their unsaved edits came back — with a one-click bail-out.
  useEffect(() => {
    if (localDraft === null) return
    toast("Draft restored", {
      // Stable id dedupes StrictMode's double-invoked mount effect (and any
      // remount) into a single toast instead of stacking duplicates.
      id: `draft-restored:${storeKey}`,
      description: "Your unsaved edits from last time are back.",
      action: {
        label: isUpdate ? "Reset to saved" : "Discard",
        onClick: resetToSaved,
      },
    })
    // Fire once, for the restoring mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Variant CRUD handlers. The variants state + module cache + epoch stay here
  // (composition root); this just sequences snapshot → mutate → navigate.
  const variantActions = useVariantActions({
    variants,
    setVariants,
    clampedActiveIndex,
    captureActiveSnapshot,
    navigate,
    bumpVariantEpoch,
    activeFormIndex,
  })

  return (
    <RankHoverProvider value={rankHover}>
      <EditorHeader
        item={item}
        category={category}
        slug={slug}
        buildSlug={buildSlug}
        categoryLabel={categoryLabel}
        totalEndoCost={totalEndoCost}
        formaCount={formaCount}
        buildName={buildName}
        displayImageName={displayImageName}
        onBuildNameChange={setBuildName}
        onSave={handleSaveClick}
        saveStatus={saveStatus}
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
        onShare={handleShare}
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
            mode="edit"
            item={effectiveItem}
            category={category}
            isCompanion={isCompanion}
            normalSlotCount={normalSlotCount}
            auraSlotCount={auraSlotCount}
            showExilus={showExilus}
            showStance={showStance}
            arcaneCount={arcaneCount}
            slots={slots}
            arcanes={arcanes}
            arcaneConfig={arcaneConfig}
            sidebarProps={{
              item,
              category,
              capacityUsed: capacity.used,
              capacityMax: capacity.max,
              autoFormaCount:
                autoForma.reactiveAutoFormaPlan?.steps.length ?? 0,
              autoFormaNoFix: autoForma.noFixFound,
              onAutoForma: autoForma.handleAutoForma,
              hasReactor,
              onToggleReactor: () => setHasReactor((v) => !v),
              shards,
              onSetShard: setShard,
              helminth,
              onSetHelminth: setHelminthAt,
              zawComponents,
              onSetZawComponents: setZawComponents,
              kitgunComponents,
              onSetKitgunComponents: setKitgunComponents,
              lichBonusElement,
              onSetLichBonusElement: setLichBonusElement,
              incarnonEnabled,
              onToggleIncarnon: () => setIncarnonEnabled((v) => !v),
              incarnonPerks,
              onSetIncarnonPerk: setIncarnonPerkAt,
              deploymentContext,
              onSetDeploymentContext: setDeploymentContext,
              placedMods: slots.placed,
              placedArcanes: arcanes.placed,
              formAbilities,
              helminthAllowed,
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
              />
            }
            onEditRiven={riven.openForEdit}
            conflicts={conflictMap}
          />

          <div className="bg-card rounded-lg border p-4">
            <SearchPanel
              item={item}
              category={category}
              usedModNames={slots.usedNames}
              conflictUniqueNames={conflictUniqueNames}
              onSelect={handleModSelect}
              helminth={helminth}
              selectedSlotKind={
                // Plexus slot pools are governed by `selectedPlexusGroup`,
                // not by the generic aura/exilus/stance predicates — those
                // would dim every Plexus mod (none carry compatName=AURA).
                category === "railjack"
                  ? undefined
                  : slots.selected
                    ? slotKind(slots.selected)
                    : undefined
              }
              selectedSlot={slots.selected}
              selectedPlexusGroup={(() => {
                if (category !== "railjack" || !slots.selected) return undefined
                // Aura slot lives inside the Integrated tab.
                if (slots.selected.startsWith("aura-")) return "integrated"
                const m = /^normal-(\d+)$/.exec(slots.selected)
                if (!m) return undefined
                const idx = Number(m[1])
                return getPlexusGroupForIndex(category, idx) ?? undefined
              })()}
              plexusFillCounts={plexusFillCounts}
              selectedIsPlexusAura={
                category === "railjack" && !!slots.selected?.startsWith("aura-")
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
          username:
            (session?.user as { username?: string | null } | undefined)
              ?.username ?? null,
          image: session?.user?.image ?? null,
        }}
        organizations={organizations}
        confirmLabel={isUpdate ? "Update settings" : "Save build"}
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
          publish.setDialogOpen(false)
          if (!isUpdate) void performSave(next, nextOrgId, nextHideAuthor)
        }}
      />

      {riven.dialog}

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
