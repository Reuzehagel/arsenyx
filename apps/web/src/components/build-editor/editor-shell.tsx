import {
  decodeBuildDoc,
  encodeBuild,
  encodeBuildDoc,
} from "@arsenyx/shared/warframe/build-codec"
import {
  MAX_VARIANTS,
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
import { getCategoryLabel, type BrowseCategory } from "@/lib/warframe"

import { AutoFormaDialog } from "./auto-forma-dialog"
import { useBuildDerived, getBuildLayout } from "./build-derived"
import { BuildSurface } from "./build-surface"
import { DragController } from "./drag-controller"
import { EditorVariantBar } from "./editor-variant-bar"
import { GuideEditor, type GuideScope } from "./guide-editor"
import { KeyboardHintBanner } from "./keyboard-hints"
import { getPlexusGroupForIndex } from "./layout"
import { resolveInitialArcanes } from "./layout"
import {
  computeMultiVariantPlan,
  computeReactiveAutoFormaPlan,
  type FullAutoFormaPlan,
} from "./multi-variant-auto-forma"
import { PublishDialog, type PublishVisibility } from "./publish-dialog"
import { useArcaneSlots, type PlacedArcane } from "./use-arcane-slots"
import {
  dropOrphanSlots,
  useBuildSlots,
  slotKind,
  type PlacedMod,
  type SlotId,
} from "./use-build-slots"
import { useEditorHistory } from "./use-editor-history"
import { useSlotKeyboardNav } from "./use-keyboard-nav"

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
  shards?: (PlacedShard | null)[]
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
      if (doc.variants.length === 1) return { data: activeData }
      const savedVariants: SavedVariant[] = doc.variants.map((v, i) => {
        const state = projectVariant(doc, i)
        const { data } = buildStateToSavedData(state, allMods, allArcanes)
        return {
          id: v.id,
          label: v.label,
          slots: data.slots ?? {},
          arcanes: data.arcanes ?? [],
          helminth: data.helminth,
          incarnonEnabled: data.incarnonEnabled,
          incarnonPerks: data.incarnonPerks,
          deploymentContext: data.deploymentContext,
          guideSummary: v.guideSummary,
          guideDescription: v.guideDescription,
        }
      })
      return { data: { ...activeData, variants: savedVariants } }
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
    cachedVariants = { key: storeKey, data: initial }
    return initial
  })
  const setVariants = (
    next: SavedVariant[] | ((prev: SavedVariant[]) => SavedVariant[]),
  ) => {
    _setVariants((prev) => {
      const value =
        typeof next === "function"
          ? (next as (p: SavedVariant[]) => SavedVariant[])(prev)
          : next
      // Preserve `shared` — setVariants only owns the variants array.
      const sharedSlot =
        cachedVariants?.key === storeKey ? cachedVariants.shared : undefined
      cachedVariants = { key: storeKey, data: value, shared: sharedSlot }
      return value
    })
  }
  const clampedActiveIndex = Math.min(
    Math.max(0, activeVariantIndex),
    variants.length - 1,
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
      helminth: active.helminth,
      incarnonEnabled: active.incarnonEnabled,
      incarnonPerks: active.incarnonPerks,
      deploymentContext: active.deploymentContext,
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

  const layout = useMemo(() => getBuildLayout(item, category), [item, category])
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

  const [visibility, setVisibility] = useState<PublishVisibility>(
    () => existingBuild?.visibility ?? "PUBLIC",
  )
  const [organizationId, setOrganizationId] = useState<string | null>(
    () => existingBuild?.organization?.id ?? null,
  )
  const [hideAuthor, setHideAuthor] = useState<boolean>(
    () => existingBuild?.hideAuthor ?? false,
  )
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  const { data: myOrgs } = useQuery({
    ...myOrgsQuery(),
    enabled: !!session?.user && publishDialogOpen,
  })
  const organizations = myOrgs?.memberships.map((m) => m.organization) ?? []

  const [hasReactor, setHasReactor] = useState(
    () => cachedShared?.hasReactor ?? savedData.hasReactor ?? true,
  )
  const [shards, setShards] = useState<(PlacedShard | null)[]>(
    () => cachedShared?.shards ?? padShards(savedData.shards),
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

  const [guideSummary, setGuideSummary] = useState(
    () =>
      cachedShared?.guideSummary ??
      localDraft?.guideSummary ??
      existingBuild?.guide?.summary ??
      "",
  )
  const [guideDescription, setGuideDescription] = useState(
    () =>
      cachedShared?.guideDescription ??
      localDraft?.guideDescription ??
      existingBuild?.guide?.description ??
      "",
  )
  // Scope of the GuideEditor — build-wide vs a specific variant. Resets
  // to "build" on EditorShell remount (variant switches) which keeps the
  // UX predictable: switching variants doesn't silently change what
  // guide you're editing.
  const [guideScope, setGuideScope] = useState<GuideScope>({ kind: "build" })

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
      shards,
      zawComponents,
      kitgunComponents,
      lichBonusElement,
      buildName,
      guideSummary,
      guideDescription,
      formaPolarities: slots.formaPolarities,
    })
    // writeShared closes over storeKey; intentionally excluded — storeKey
    // changes trigger a full EditorShell remount, not a re-sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasReactor,
    shards,
    zawComponents,
    kitgunComponents,
    lichBonusElement,
    buildName,
    guideSummary,
    guideDescription,
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
  } = useBuildDerived({ item, category, layout, slots, allArcanes, hasReactor })

  // Reactive auto-forma plan — fast (stage 1 + greedy fallback only) so it
  // runs on every render without blocking input. Stages 2/3 (rearrangement,
  // Omni Forma) are kicked off lazily inside the click handler so the heavy
  // search doesn't lag mod placement.
  //
  // Forma is build-wide in Warframe — every variant shares one
  // `formaPolarities` — so the planner overlays the active variant's live
  // editor state onto the saved `variants[]` array and considers the whole
  // set.
  const allVariantSlots = useMemo(
    () =>
      variants.map((v, i) =>
        // The active variant's `placed` is already orphan-stripped by
        // useBuildSlots. Inactive variants come straight from the saved doc, so
        // strip them here too — otherwise a mod left in a slot this item no
        // longer has (e.g. an Exilus mod on a legacy companion-weapon build)
        // still feeds the auto-forma planner's capacity math and inflates that
        // variant's `used`, producing phantom forma recommendations.
        i === clampedActiveIndex
          ? slots.placed
          : dropOrphanSlots(v.slots ?? {}, layout),
      ),
    [variants, clampedActiveIndex, slots.placed, layout],
  )
  const reactiveAutoFormaPlan = useMemo<FullAutoFormaPlan | null>(() => {
    if (capacity.used <= capacity.max) return null
    return computeReactiveAutoFormaPlan({
      ...capacitySharedInputs,
      formaPolarities: slots.formaPolarities,
      variantSlots: allVariantSlots,
    })
  }, [
    capacity.used,
    capacity.max,
    capacitySharedInputs,
    slots.formaPolarities,
    allVariantSlots,
  ])

  const [autoFormaDialogOpen, setAutoFormaDialogOpen] = useState(false)
  const [pendingHeavyPlan, setPendingHeavyPlan] =
    useState<FullAutoFormaPlan | null>(null)

  const applyAutoFormaPlan = (plan: FullAutoFormaPlan) => {
    // Apply forma changes first so the active-variant capacity computation
    // sees the new polarities by the time rearrangements land.
    for (const step of plan.steps) {
      slots.setForma(step.id, step.polarity)
    }
    // Apply per-variant rearrangements: active variant goes through the
    // slots hook; the rest update the in-memory `variants[]` array directly.
    for (const arr of plan.rearrangements) {
      if (arr.variantIndex === clampedActiveIndex) {
        slots.setPlaced(arr.placed)
      } else {
        setVariants((prev) =>
          prev.map((v, i) =>
            i === arr.variantIndex ? { ...v, slots: arr.placed } : v,
          ),
        )
      }
    }
  }

  // "No fix found" feedback — flips true briefly after a fruitless click so
  // the button can hint at the result instead of looking broken. The timer
  // lives in an effect so we clear it on unmount (variant switch, route
  // change) and avoid setState on a dead component.
  const [noFixFound, setNoFixFound] = useState(false)
  useEffect(() => {
    if (!noFixFound) return
    const id = window.setTimeout(() => setNoFixFound(false), 1800)
    return () => window.clearTimeout(id)
  }, [noFixFound])
  const flashNoFix = () => setNoFixFound(true)
  const handleAutoForma = () => {
    // Fast path: reactive plan exists → silent apply. Matches the single-
    // variant UX where the button always applies forma-only improvements.
    if (reactiveAutoFormaPlan && reactiveAutoFormaPlan.steps.length > 0) {
      applyAutoFormaPlan(reactiveAutoFormaPlan)
      return
    }
    // Reactive plan empty — run the full stages 1→2→3 cascade on click.
    // Synchronous, but only at click time so it doesn't lag editing.
    const plan = computeMultiVariantPlan({
      ...capacitySharedInputs,
      formaPolarities: slots.formaPolarities,
      variantSlots: allVariantSlots,
    })
    if (!plan) {
      flashNoFix()
      return
    }
    if (plan.stage === 1) {
      // Cascade found a stage-1 plan that the cheap reactive path missed
      // (different search semantics — DFS vs greedy). Apply silently.
      applyAutoFormaPlan(plan)
      return
    }
    // Stages 2/3 move user mods or burn Omni Forma — show the preview.
    setPendingHeavyPlan(plan)
    setAutoFormaDialogOpen(true)
  }

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
    if (variants.length > 1) {
      // Build a BuildDoc that mirrors the current editor state: shared
      // fields from `state`, per-variant data from the in-memory variants
      // array (with the active variant's slice replaced by the live
      // editor state so unsaved tweaks make it into the share URL).
      const activeSnapshot = captureActiveSnapshot()
      const allVariants = variants.map((v, i) =>
        i === clampedActiveIndex ? activeSnapshot : v,
      )
      const doc: BuildDoc = {
        itemUniqueName: state.itemUniqueName,
        itemName: state.itemName,
        itemCategory: state.itemCategory,
        itemImageName: state.itemImageName,
        hasReactor: state.hasReactor,
        shardSlots: state.shardSlots,
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
            shards,
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
            incarnonEnabled: variantState.incarnonEnabled,
            incarnonPerks: variantState.incarnonPerks,
            deploymentContext: variantState.deploymentContext,
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
      setPublishDialogOpen(true)
      return
    }
    void performSave(visibility, organizationId, hideAuthor)
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
    setPublishDialogOpen(false)
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
        guide: {
          summary: guideSummary.trim() || null,
          description: guideDescription.trim() || null,
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
      helminth,
      incarnonEnabled,
      incarnonPerks,
      deploymentContext,
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
    return stripPersistedImages({
      version: 1,
      slots: slots.placed,
      formaPolarities: slots.formaPolarities,
      arcanes: arcanes.placed,
      shards,
      hasReactor,
      helminth,
      zawComponents,
      kitgunComponents,
      lichBonusElement: lichBonusElement ?? undefined,
      incarnonEnabled,
      incarnonPerks,
      deploymentContext,
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
        guideSummary,
        guideDescription,
      })
      setHasDraft(true)
    }, 600)
    return () => window.clearTimeout(handle)
    // Re-run on any edit. captureBuildData reads the values below; listing them
    // keeps the snapshot current without re-binding the helper in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    buildName,
    guideSummary,
    guideDescription,
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

  const newVariantId = () =>
    `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

  const switchVariant = (i: number) => {
    if (i === clampedActiveIndex) return
    const snapshot = captureActiveSnapshot()
    const next = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    setVariants(next)
    navigate({
      to: ".",
      // When `share` is in the URL, `v: undefined` lets validateSearch's
      // `activeVariantFromShare` fallback re-derive v from the share's
      // encoded activeIndex — which silently overrides the user's click
      // back to variant 0. Emit explicit `v: 0` in that case so the user's
      // choice wins. Clean `v: undefined` when share is absent.
      search: (s) => ({ ...s, v: i === 0 && !s.share ? undefined : i }),
      replace: true,
    })
  }

  const addVariant = () => {
    if (variants.length >= MAX_VARIANTS) return
    const snapshot = captureActiveSnapshot()
    const seeded = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    const blank: SavedVariant = {
      id: newVariantId(),
      label: `Variant ${seeded.length + 1}`,
      slots: {},
      arcanes: [],
    }
    const next = [...seeded, blank]
    setVariants(next)
    navigate({
      to: ".",
      search: (s) => ({ ...s, v: next.length - 1 }),
      replace: true,
    })
    bumpVariantEpoch()
  }

  const duplicateActive = () => {
    if (variants.length >= MAX_VARIANTS) return
    const snapshot = captureActiveSnapshot()
    const dup: SavedVariant = {
      ...snapshot,
      id: newVariantId(),
      label: `${snapshot.label} (copy)`,
    }
    const seeded = variants.map((v, idx) =>
      idx === clampedActiveIndex ? snapshot : v,
    )
    const insertAt = clampedActiveIndex + 1
    const next = [...seeded.slice(0, insertAt), dup, ...seeded.slice(insertAt)]
    setVariants(next)
    navigate({
      to: ".",
      search: (s) => ({ ...s, v: insertAt === 0 ? undefined : insertAt }),
      replace: true,
    })
    bumpVariantEpoch()
  }

  const deleteActive = () => {
    if (variants.length <= 1) return
    const next = variants.filter((_, i) => i !== clampedActiveIndex)
    setVariants(next)
    const newIdx = Math.min(clampedActiveIndex, next.length - 1)
    navigate({
      to: ".",
      // Same share-aware fallback as switchVariant.
      search: (s) => ({
        ...s,
        v: newIdx === 0 && !s.share ? undefined : newIdx,
      }),
      replace: true,
    })
    // Deleting a non-last active variant keeps `?v` unchanged (the next
    // variant slides into this index), so the navigate alone won't remount.
    // Bump the epoch to force the re-hydration regardless.
    bumpVariantEpoch()
  }

  const renameActive = (label: string) => {
    const trimmed =
      label.trim().slice(0, 24) || `Variant ${clampedActiveIndex + 1}`
    setVariants((prev) =>
      prev.map((v, i) =>
        i === clampedActiveIndex ? { ...v, label: trimmed } : v,
      ),
    )
  }

  return (
    <>
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
            ? { visibility, onEdit: () => setPublishDialogOpen(true) }
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
            item={item}
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
              autoFormaCount: reactiveAutoFormaPlan?.steps.length ?? 0,
              autoFormaNoFix: noFixFound,
              onAutoForma: handleAutoForma,
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
            }}
            topBarLayout="row"
            topBar={
              <EditorVariantBar
                variants={variants}
                activeIndex={clampedActiveIndex}
                onSwitch={switchVariant}
                onAdd={addVariant}
                onDuplicate={duplicateActive}
                onDelete={deleteActive}
                onRename={renameActive}
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
              summary={
                guideScope.kind === "build"
                  ? guideSummary
                  : (variants[guideScope.index]?.guideSummary ?? "")
              }
              onSummaryChange={(v) => {
                if (guideScope.kind === "build") {
                  setGuideSummary(v)
                  return
                }
                const idx = guideScope.index
                setVariants((prev) =>
                  prev.map((sv, i) =>
                    i === idx ? { ...sv, guideSummary: v } : sv,
                  ),
                )
              }}
              description={
                guideScope.kind === "build"
                  ? guideDescription
                  : (variants[guideScope.index]?.guideDescription ?? "")
              }
              onDescriptionChange={(v) => {
                if (guideScope.kind === "build") {
                  setGuideDescription(v)
                  return
                }
                const idx = guideScope.index
                setVariants((prev) =>
                  prev.map((sv, i) =>
                    i === idx ? { ...sv, guideDescription: v } : sv,
                  ),
                )
              }}
              buildSlug={isUpdate ? existingBuild?.slug : undefined}
              scopes={variants.map((v) => ({
                id: v.id,
                label: v.label,
                hasContent: Boolean(
                  (v.guideSummary && v.guideSummary.trim()) ||
                  (v.guideDescription && v.guideDescription.trim()),
                ),
              }))}
              activeScope={guideScope}
              onScopeChange={setGuideScope}
            />
          </div>
        </div>
      </DragController>

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        initialVisibility={visibility}
        initialOrganizationId={organizationId}
        initialHideAuthor={hideAuthor}
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
          setVisibility(next)
          setOrganizationId(nextOrgId)
          setHideAuthor(nextHideAuthor)
          setPublishDialogOpen(false)
          if (!isUpdate) void performSave(next, nextOrgId, nextHideAuthor)
        }}
      />

      {riven.dialog}

      {pendingHeavyPlan && (
        <AutoFormaDialog
          open={autoFormaDialogOpen}
          onOpenChange={(open) => {
            setAutoFormaDialogOpen(open)
            if (!open) setPendingHeavyPlan(null)
          }}
          plan={pendingHeavyPlan}
          variantLabels={variants.map((v) => v.label)}
          originalVariantSlots={allVariantSlots}
          onApply={() => applyAutoFormaPlan(pendingHeavyPlan)}
        />
      )}
    </>
  )
}
