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
import { useEffect, useMemo, useState } from "react"

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
  SYNTHETIC_VARIANT_ID,
  SYNTHETIC_VARIANT_LABEL,
} from "@/lib/codec/build-codec-adapter"
import { useHotkey } from "@/lib/hooks/hotkeys"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
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
import { modsQuery } from "@/lib/queries/mods-query"
import { myOrgsQuery } from "@/lib/queries/org-query"
import { padShards, type PlacedShard } from "@/lib/shards"
import { apiErrorMessage, apiFetch } from "@/lib/util/api-client"
import { getCategoryLabel, type BrowseCategory } from "@/lib/warframe"

import { useBuildDerived, getBuildLayout } from "./build-derived"
import { BuildSurface } from "./build-surface"
import { DragController } from "./drag-controller"
import { EditorVariantBar } from "./editor-variant-bar"
import { GuideEditor, type GuideScope } from "./guide-editor"
import { KeyboardHintBanner } from "./keyboard-hints"
import { getPlexusGroupForIndex } from "./layout"
import { resolveInitialArcanes } from "./layout"
import { PublishDialog, type PublishVisibility } from "./publish-dialog"
import { useArcaneSlots } from "./use-arcane-slots"
import { useBuildSlots, slotKind } from "./use-build-slots"
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

export function resetEditorCache() {
  cachedVariants = null
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
  // Full normalized saved data (all variants intact); used when persisting.
  const savedDataAll: SavedBuildData = useMemo(() => {
    if (draft) return draft.data
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
    existingBuild,
    shareHydrated,
    allMods,
    allArcanes,
    helminthAbilities,
  ])

  // Track the variants list as mutable state so add/duplicate/delete can
  // mutate it before save without round-tripping through the URL.
  // EditorShell is re-keyed on variant switch, which would normally reset
  // useState. The module-level cache below preserves the in-progress
  // variants array across those remounts (keyed by buildSlug, single
  // entry — replaced when switching to a different build).
  // Include `item` and `category` so two consecutive new-build sessions on
  // different items don't share the same cache bucket (the EditorShell isn't
  // re-keyed on item change, but the cache lookup must still distinguish).
  const storeKey = buildSlug ?? `__new_build__:${category}:${slug}`
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
  } = layout
  const slots = useBuildSlots(normalSlotCount, {
    placed: savedData.slots,
    // Forma is build-wide (shared across variants); use the cached
    // override so unsaved forma edits survive variant switches.
    formaPolarities: cachedShared?.formaPolarities ?? savedData.formaPolarities,
    auraSlotCount,
    showExilus,
    showStance,
  })
  useSlotKeyboardNav({
    slots,
    layout: { normalSlotCount, auraSlotCount, showExilus, showStance },
  })
  const arcanes = useArcaneSlots(
    arcaneCount,
    resolveInitialArcanes(item, savedData.arcanes),
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
      existingBuild?.name ??
      draft?.buildName ??
      item.name,
  )
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">(
    "idle",
  )
  const [saveError, setSaveError] = useState<string | null>(null)

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
    () => cachedShared?.guideSummary ?? existingBuild?.guide?.summary ?? "",
  )
  const [guideDescription, setGuideDescription] = useState(
    () =>
      cachedShared?.guideDescription ?? existingBuild?.guide?.description ?? "",
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

  // Innates, endo/forma totals, capacity, and arcane picker config — same
  // computation for view (`/builds/$slug`) and edit (`/create`).
  const { arcaneConfig, totalEndoCost, formaCount, capacity } = useBuildDerived(
    { item, category, layout, slots, allArcanes, hasReactor },
  )

  const isUpdate = !!existingBuild && existingBuild.isOwner

  const { copied: shareCopied, copy: copyShare } = useCopyToClipboard()
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
    void copyShare(url)
  }

  const handleSaveClick = () => {
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
    setSaveError(null)
    try {
      // Snapshot the active variant's current editor state, then merge
      // back into the full variants array. Single-variant builds emit
      // a v1-shape payload (no `variants` field) for backwards-compat;
      // multi-variant builds emit both top-level (mirroring active for
      // legacy clients) and the variants array.
      const activeSnapshot = captureActiveSnapshot()
      const nextVariants = variants.map((v, i) =>
        i === clampedActiveIndex ? activeSnapshot : v,
      )
      const body = {
        name: buildName.trim() || item.name,
        visibility: nextVisibility,
        organizationId: nextOrganizationId,
        hideAuthor: nextHideAuthor,
        buildData: {
          version: 1,
          slots: slots.placed,
          formaPolarities: slots.formaPolarities,
          arcanes: arcanes.placed,
          shards,
          hasReactor,
          helminth,
          zawComponents,
          lichBonusElement: lichBonusElement ?? undefined,
          incarnonEnabled,
          incarnonPerks,
          deploymentContext,
          // Emit `variants` whenever there's more than one OR the single
          // remaining variant has a user-assigned label/id — otherwise the
          // synthetic placeholder from getVariants() would silently
          // overwrite the user's label after delete-down-to-one.
          ...((nextVariants.length > 1 ||
            !isSyntheticVariant(nextVariants[0])) && {
            variants: nextVariants,
          }),
        },
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
      // from the persisted server state rather than stale local edits.
      cachedVariants = null
      navigate({ to: "/builds/$slug", params: { slug } })
    } catch (err) {
      setSaveStatus("error")
      setSaveError(apiErrorMessage(err, "save_failed"))
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
        saveError={saveError}
        isSignedIn={!!session?.user}
        settings={
          isUpdate
            ? { visibility, onEdit: () => setPublishDialogOpen(true) }
            : undefined
        }
        onShare={handleShare}
        shareCopied={shareCopied}
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
            arcaneCount={arcaneCount}
            slots={slots}
            arcanes={arcanes}
            arcaneConfig={arcaneConfig}
            sidebarProps={{
              item,
              category,
              capacityUsed: capacity.used,
              capacityMax: capacity.max,
              hasReactor,
              onToggleReactor: () => setHasReactor((v) => !v),
              shards,
              onSetShard: setShard,
              helminth,
              onSetHelminth: setHelminthAt,
              zawComponents,
              onSetZawComponents: setZawComponents,
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
          />

          <div className="bg-card rounded-lg border p-4">
            <SearchPanel
              item={item}
              category={category}
              usedModNames={slots.usedNames}
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
    </>
  )
}
