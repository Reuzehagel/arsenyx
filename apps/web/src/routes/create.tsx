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
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"

import {
  ArcaneRow,
  DragController,
  calculateCapacity,
  calculateFormaCount,
  calculateTotalEndoCost,
  getArcaneSlotConfig,
  getArcaneSlotCount,
  getAuraPolarities,
  getAuraSlotCount,
  getExilusInnatePolarity,
  getStanceInnatePolarity,
  getMaxLevelCap,
  getNormalSlotCount,
  getPlexusGroupForIndex,
  GuideEditor,
  type GuideScope,
  hasExilusSlot,
  hasStanceSlot,
  ItemSidebar,
  ItemSidebarPopover,
  KeyboardHintBanner,
  KeyboardHintsStrip,
  ModGrid,
  PublishDialog,
  type PublishVisibility,
  resolveInitialArcanes,
  toPolarity,
  useArcaneSlots,
  slotKind,
  useBuildSlots,
  useSlotKeyboardNav,
} from "@/components/build-editor"
import { EditorHeader } from "@/components/create-editor/editor-header"
import { SearchPanel } from "@/components/create-editor/search-panel"
import { useRivenDialog } from "@/components/create-editor/use-riven-dialog"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { apiErrorMessage, apiFetch } from "@/lib/api-client"
import { arcanesQuery } from "@/lib/arcanes-query"
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
} from "@/lib/build-codec-adapter"
import {
  buildQuery,
  type SavedBuildData,
  type SavedVariant,
} from "@/lib/build-query"
import { helminthQuery, type HelminthAbility } from "@/lib/helminth-query"
import { useHotkey } from "@/lib/hotkeys"
import { consumeDraft } from "@/lib/import-draft"
import { itemQuery } from "@/lib/item-query"
import { modsQuery } from "@/lib/mods-query"
import { myOrgsQuery } from "@/lib/org-query"
import { padShards, type PlacedShard } from "@/lib/shards"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { cn } from "@/lib/utils"
import {
  getCategoryLabel,
  isValidCategory,
  type BrowseCategory,
} from "@/lib/warframe"

type CreateSearch = {
  item: string
  category: BrowseCategory
  build?: string
  draft?: string
  share?: string
  /** Active variant index for multi-variant builds. 0 (or undefined) =
   *  first variant. */
  v?: number
}

export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>): CreateSearch => {
    const item = typeof search.item === "string" ? search.item : ""
    const category =
      typeof search.category === "string" && isValidCategory(search.category)
        ? search.category
        : ("warframes" as BrowseCategory)
    const build = typeof search.build === "string" ? search.build : undefined
    const draft = typeof search.draft === "string" ? search.draft : undefined
    const share = typeof search.share === "string" ? search.share : undefined
    const rawV =
      typeof search.v === "string"
        ? Number(search.v)
        : typeof search.v === "number"
          ? search.v
          : undefined
    const v =
      rawV !== undefined && Number.isFinite(rawV) && rawV >= 0
        ? Math.min(50, Math.floor(rawV))
        : undefined
    return {
      item,
      category,
      build,
      draft,
      share,
      ...(v !== undefined && { v }),
    }
  },
  beforeLoad: ({ search }) => {
    if (!search.item) {
      throw redirect({ to: "/browse", search: { category: "warframes" } })
    }
  },
  loaderDeps: ({ search }) => ({
    item: search.item,
    category: search.category,
    build: search.build,
  }),
  loader: async ({ context, deps }) => {
    const tasks: Promise<unknown>[] = [
      context.queryClient.ensureQueryData(itemQuery(deps.category, deps.item)),
      context.queryClient.ensureQueryData(modsQuery),
      context.queryClient.ensureQueryData(arcanesQuery),
    ]
    if (deps.category === "warframes") {
      tasks.push(context.queryClient.ensureQueryData(helminthQuery))
    }
    if (deps.build) {
      tasks.push(context.queryClient.ensureQueryData(buildQuery(deps.build)))
    }
    await Promise.all(tasks)
  },
  component: CreatePage,
})

function CreatePage() {
  // Re-key EditorShell on variant switch so the per-variant hooks
  // (useBuildSlots / useArcaneSlots) re-initialize from the projected
  // variant's data. Cheaper than extracting + threading callbacks for
  // every per-variant setter through every subcomponent.
  const { build: buildSlug, v } = Route.useSearch()
  const variantKey = `${buildSlug ?? "new"}-${v ?? 0}`
  // Drop the in-memory editor cache on every navigation away from
  // /create (Cancel, route change). Without this, an unsaved variant
  // added before Cancel would silently re-appear next time the user
  // opened the same build's editor.
  useEffect(
    () => () => {
      cachedVariants = null
    },
    [],
  )
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap px-4 py-4 md:py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading item…</p>}
          >
            <EditorShell key={variantKey} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// Survives EditorShell remounts (the editor is re-keyed on variant switch
// so per-variant hooks can re-initialize from the new variant's data).
// Single-entry cache keyed by buildSlug — replaced when editing a
// different build. Cleared on successful save below.
type SharedEditorOverrides = {
  hasReactor?: boolean
  shards?: (PlacedShard | null)[]
  zawComponents?: { grip: string; link: string } | undefined
  lichBonusElement?: LichBonusElement | null
  formaPolarities?: Partial<
    Record<string, import("@arsenyx/shared/warframe/types").Polarity>
  >
  buildName?: string
  guideSummary?: string
  guideDescription?: string
}
let cachedVariants: {
  key: string
  data: SavedVariant[]
  shared?: SharedEditorOverrides
} | null = null

function EditorShell() {
  const {
    item: slug,
    category,
    build: buildSlug,
    draft: draftId,
    share: shareEncoded,
    v: activeVariantIndex = 0,
  } = Route.useSearch()
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
  // hooks below. EditorShell is re-keyed by activeIndex in CreatePage,
  // so this useMemo only runs at mount (the right semantics). Reads
  // from the in-memory `variants` state (which may contain unsaved
  // add/duplicate/rename edits) rather than re-deriving from server
  // data.
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

  const isCompanion = category === "companions"
  const normalSlotCount = getNormalSlotCount(category)
  const auraSlotCount = getAuraSlotCount(category, item)
  const showExilus = hasExilusSlot(category)
  const showStance = hasStanceSlot(item, category)
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
  const arcaneCount = getArcaneSlotCount(category, item.type)
  const arcanes = useArcaneSlots(
    arcaneCount,
    resolveInitialArcanes(item, savedData.arcanes),
  )
  const arcaneConfig = useMemo(
    () => getArcaneSlotConfig(allArcanes, category, arcaneCount, item),
    [allArcanes, category, arcaneCount, item],
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

  const auraInnates = useMemo(
    () => getAuraPolarities(item, auraSlotCount),
    [item, auraSlotCount],
  )
  const exilusInnate = useMemo(() => getExilusInnatePolarity(item), [item])
  const stanceInnate = useMemo(() => getStanceInnatePolarity(item), [item])
  const normalInnates = useMemo(
    () =>
      Array.from({ length: normalSlotCount }, (_, i) =>
        toPolarity(item.polarities?.[i]),
      ),
    [item.polarities, normalSlotCount],
  )

  const totalEndoCost = useMemo(
    () => calculateTotalEndoCost(slots.placed),
    [slots.placed],
  )
  const formaCount = useMemo(
    () =>
      calculateFormaCount({
        auraInnates,
        exilusInnate,
        stanceInnate,
        normalInnates,
        formaPolarities: slots.formaPolarities,
      }),
    [
      auraInnates,
      exilusInnate,
      stanceInnate,
      normalInnates,
      slots.formaPolarities,
    ],
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

  // Plexus Battle (normal-0..2) and Tactical (normal-3..5) mods don't draw
  // from the Integrated capacity pool. Build a per-slot mask for railjack;
  // omit it elsewhere so other categories keep counting every normal slot.
  const normalSlotConsumesDrain = useMemo(() => {
    if (category !== "railjack") return undefined
    return Array.from({ length: normalSlotCount }, (_, i) => {
      const group = getPlexusGroupForIndex(category, i)
      return group === "integrated"
    })
  }, [category, normalSlotCount])

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

  const capacity = useMemo(
    () =>
      calculateCapacity({
        placed: slots.placed,
        formaPolarities: slots.formaPolarities,
        auraInnates,
        exilusInnate,
        stanceInnate,
        normalInnates,
        hasReactor,
        maxLevelCap: getMaxLevelCap(category, item),
        normalSlotConsumesDrain,
      }),
    [
      slots.placed,
      slots.formaPolarities,
      auraInnates,
      exilusInnate,
      stanceInnate,
      normalInnates,
      hasReactor,
      category,
      item,
      normalSlotConsumesDrain,
    ],
  )

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
      search: (s) => ({ ...s, v: i === 0 ? undefined : i }),
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
      search: (s) => ({ ...s, v: newIdx === 0 ? undefined : newIdx }),
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
          <div className="flex flex-col gap-4 xl:relative xl:block">
            <div className="flex w-full flex-col sm:hidden xl:absolute xl:top-0 xl:bottom-0 xl:left-0 xl:flex xl:w-[260px]">
              <ItemSidebar
                item={item}
                category={category}
                capacityUsed={capacity.used}
                capacityMax={capacity.max}
                hasReactor={hasReactor}
                onToggleReactor={() => setHasReactor((v) => !v)}
                shards={shards}
                onSetShard={setShard}
                helminth={helminth}
                onSetHelminth={setHelminthAt}
                zawComponents={zawComponents}
                onSetZawComponents={setZawComponents}
                lichBonusElement={lichBonusElement}
                onSetLichBonusElement={setLichBonusElement}
                incarnonEnabled={incarnonEnabled}
                onToggleIncarnon={() => setIncarnonEnabled((v) => !v)}
                incarnonPerks={incarnonPerks}
                onSetIncarnonPerk={setIncarnonPerkAt}
                deploymentContext={deploymentContext}
                onSetDeploymentContext={setDeploymentContext}
                placedMods={slots.placed}
                placedArcanes={arcanes.placed}
              />
            </div>

            <div
              className="bg-card @container/loadout flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border p-2 sm:p-4 xl:ml-[calc(260px+1rem)]"
              onClick={(e) => {
                if (!(e.target instanceof HTMLElement)) return
                if (!e.target.closest("[data-build-slot]")) {
                  slots.select(null)
                  arcanes.select(null)
                }
              }}
            >
              <div className="flex items-center gap-2">
                <ItemSidebarPopover
                  className="hidden shrink-0 sm:inline-flex xl:hidden"
                  item={item}
                  category={category}
                  capacityUsed={capacity.used}
                  capacityMax={capacity.max}
                  hasReactor={hasReactor}
                  onToggleReactor={() => setHasReactor((v) => !v)}
                  shards={shards}
                  onSetShard={setShard}
                  helminth={helminth}
                  onSetHelminth={setHelminthAt}
                  zawComponents={zawComponents}
                  onSetZawComponents={setZawComponents}
                  lichBonusElement={lichBonusElement}
                  onSetLichBonusElement={setLichBonusElement}
                  incarnonEnabled={incarnonEnabled}
                  onToggleIncarnon={() => setIncarnonEnabled((v) => !v)}
                  incarnonPerks={incarnonPerks}
                  onSetIncarnonPerk={setIncarnonPerkAt}
                  deploymentContext={deploymentContext}
                  onSetDeploymentContext={setDeploymentContext}
                  placedMods={slots.placed}
                  placedArcanes={arcanes.placed}
                />
                <div className="min-w-0 flex-1">
                  <EditorVariantBar
                    variants={variants}
                    activeIndex={clampedActiveIndex}
                    onSwitch={switchVariant}
                    onAdd={addVariant}
                    onDuplicate={duplicateActive}
                    onDelete={deleteActive}
                    onRename={renameActive}
                  />
                </div>
              </div>
              <ModGrid
                item={item}
                category={category}
                isCompanion={isCompanion}
                normalSlotCount={normalSlotCount}
                slots={slots}
                onEditRiven={riven.openForEdit}
                arcaneRow={
                  arcaneCount > 0 ? (
                    <ArcaneRow
                      arcanes={arcanes}
                      options={arcaneConfig.options}
                      labels={arcaneConfig.labels}
                    />
                  ) : undefined
                }
              />
              <KeyboardHintsStrip />
            </div>
          </div>

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

function EditorVariantBar({
  variants,
  activeIndex,
  onSwitch,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
}: {
  variants: SavedVariant[]
  activeIndex: number
  onSwitch: (index: number) => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRename: (label: string) => void
}) {
  // Hide the bar for single-variant builds until the user opts in via
  // "+ Variant". Keeps the editor visually identical to before for
  // anyone not using variants.
  if (variants.length === 1) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onAdd}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-md border border-dashed px-2 py-1 text-xs"
          title="Add a build variant"
        >
          + Variant
        </button>
      </div>
    )
  }
  const active = variants[activeIndex]
  const atCap = variants.length >= MAX_VARIANTS
  return (
    <EditorVariantBarMulti
      variants={variants}
      activeIndex={activeIndex}
      active={active}
      atCap={atCap}
      onSwitch={onSwitch}
      onAdd={onAdd}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onRename={onRename}
    />
  )
}

function EditorVariantBarMulti({
  variants,
  activeIndex,
  active,
  atCap,
  onSwitch,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
}: {
  variants: SavedVariant[]
  activeIndex: number
  active: SavedVariant
  atCap: boolean
  onSwitch: (index: number) => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRename: (label: string) => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [labelDraft, setLabelDraft] = useState(active.label)
  const inputRef = useRef<HTMLInputElement>(null)
  // Mirror renameActive's fallback so the input shows the normalized value
  // after blur — otherwise clearing the input and tabbing away leaves an
  // empty draft in the popover while the underlying variant has "Variant N".
  const commitRename = () => {
    const normalized =
      labelDraft.trim().slice(0, 24) || `Variant ${activeIndex + 1}`
    if (normalized !== labelDraft) setLabelDraft(normalized)
    onRename(normalized)
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 pb-1">
      {variants.map((v, i) => {
        const isActive = i === activeIndex
        return (
          <div key={v.id || i} className="flex items-center gap-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSwitch(i)}
              className={cn(
                "rounded-l-md border px-3 py-1 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md border-transparent",
              )}
            >
              {v.label || `Variant ${i + 1}`}
            </button>
            {isActive ? (
              <Popover
                open={settingsOpen}
                onOpenChange={(o) => {
                  setSettingsOpen(o)
                  if (o) {
                    setLabelDraft(active.label)
                    requestAnimationFrame(() => {
                      inputRef.current?.focus()
                      inputRef.current?.select()
                    })
                  }
                }}
              >
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      title="Variant settings"
                      className="border-primary bg-primary text-primary-foreground rounded-r-md border border-l-0 px-1.5 py-1 text-sm"
                    >
                      ⚙
                    </button>
                  }
                />
                <PopoverContent
                  side="bottom"
                  align="center"
                  className="w-64 p-3"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-muted-foreground text-xs">
                      Name
                    </label>
                    <Input
                      ref={inputRef}
                      value={labelDraft}
                      maxLength={24}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          commitRename()
                          setSettingsOpen(false)
                        } else if (e.key === "Escape") {
                          setSettingsOpen(false)
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <div className="mt-1 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          commitRename()
                          onDuplicate()
                          setSettingsOpen(false)
                        }}
                        disabled={atCap}
                        title={
                          atCap
                            ? `Maximum of ${MAX_VARIANTS} variants per build`
                            : "Duplicate this variant"
                        }
                        className="flex-1"
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          onDelete()
                          setSettingsOpen(false)
                        }}
                        className="flex-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAdd}
        disabled={atCap}
        title={
          atCap
            ? `Maximum of ${MAX_VARIANTS} variants per build`
            : "Add a build variant"
        }
        className={cn(
          "rounded-md border border-dashed px-2.5 py-1 text-sm",
          atCap
            ? "border-muted-foreground/20 text-muted-foreground/40 cursor-not-allowed"
            : "border-muted-foreground/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )}
      >
        + Variant
      </button>
    </div>
  )
}
