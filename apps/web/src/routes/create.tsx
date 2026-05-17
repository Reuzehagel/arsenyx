import { decodeBuild, encodeBuild } from "@arsenyx/shared/warframe/build-codec"
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
import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { Suspense, useEffect, useMemo, useState } from "react"

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
  GuideEditor,
  hasExilusSlot,
  hasStanceSlot,
  ItemSidebar,
  ItemSidebarPopover,
  KeyboardHintBanner,
  KeyboardHintsStrip,
  ModGrid,
  PublishDialog,
  type PublishVisibility,
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
import { apiErrorMessage, apiFetch } from "@/lib/api-client"
import { arcanesQuery } from "@/lib/arcanes-query"
import { authClient } from "@/lib/auth-client"
import {
  buildStateToSavedData,
  normalizeBuildData,
  savedDataToBuildState,
} from "@/lib/build-codec-adapter"
import { buildQuery, type SavedBuildData } from "@/lib/build-query"
import { helminthQuery, type HelminthAbility } from "@/lib/helminth-query"
import { useHotkey } from "@/lib/hotkeys"
import { consumeDraft } from "@/lib/import-draft"
import { itemQuery } from "@/lib/item-query"
import { modsQuery } from "@/lib/mods-query"
import { myOrgsQuery } from "@/lib/org-query"
import { padShards, type PlacedShard } from "@/lib/shards"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
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
    return { item, category, build, draft, share }
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
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap px-4 py-4 md:py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading item…</p>}
          >
            <EditorShell />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function EditorShell() {
  const {
    item: slug,
    category,
    build: buildSlug,
    draft: draftId,
    share: shareEncoded,
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
    const decoded = decodeBuild(shareEncoded)
    if (!decoded) return null
    return buildStateToSavedData(decoded, allMods, allArcanes)
  })
  const savedData: SavedBuildData = useMemo(() => {
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

  const categoryLabel = getCategoryLabel(category)

  const isCompanion = category === "companions"
  const normalSlotCount = getNormalSlotCount(category)
  const auraSlotCount = getAuraSlotCount(category, item)
  const showExilus = hasExilusSlot(category)
  const showStance = hasStanceSlot(item, category)
  const slots = useBuildSlots(normalSlotCount, {
    placed: savedData.slots,
    formaPolarities: savedData.formaPolarities,
    auraSlotCount,
    showExilus,
    showStance,
  })
  useSlotKeyboardNav({
    slots,
    layout: { normalSlotCount, auraSlotCount, showExilus, showStance },
  })
  const arcaneCount = getArcaneSlotCount(category, item.type)
  const arcanes = useArcaneSlots(arcaneCount, savedData.arcanes)
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
    () => existingBuild?.name ?? draft?.buildName ?? item.name,
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
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  const { data: myOrgs } = useQuery({
    ...myOrgsQuery(),
    enabled: !!session?.user && publishDialogOpen,
  })
  const organizations = myOrgs?.memberships.map((m) => m.organization) ?? []

  const [hasReactor, setHasReactor] = useState(
    () => savedData.hasReactor ?? true,
  )
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

  const [guideSummary, setGuideSummary] = useState(
    () => existingBuild?.guide?.summary ?? "",
  )
  const [guideDescription, setGuideDescription] = useState(
    () => existingBuild?.guide?.description ?? "",
  )

  const [zawComponents, setZawComponents] = useState<
    { grip: string; link: string } | undefined
  >(() => {
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
    useState<LichBonusElement | null>(() => savedData.lichBonusElement ?? null)

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
    const encoded = encodeBuild(state)
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
    void performSave(visibility, organizationId)
  }

  const performSave = async (
    nextVisibility: PublishVisibility,
    nextOrganizationId: string | null,
  ) => {
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    setPublishDialogOpen(false)
    setSaveStatus("saving")
    setSaveError(null)
    try {
      const body = {
        name: buildName.trim() || item.name,
        visibility: nextVisibility,
        organizationId: nextOrganizationId,
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
      const path = isUpdate
        ? `/builds/${existingBuild!.slug}`
        : `/builds`
      const { slug } = await apiFetch<{ id: string; slug: string }>(path, {
        method: isUpdate ? "PATCH" : "POST",
        json: body,
      })
      await queryClient.invalidateQueries({ queryKey: ["build", slug] })
      navigate({ to: "/builds/$slug", params: { slug } })
    } catch (err) {
      setSaveStatus("error")
      setSaveError(apiErrorMessage(err, "save_failed"))
    }
  }

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
    ],
  )

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
              <ItemSidebarPopover
                className="hidden self-start sm:inline-flex xl:hidden"
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
                slots.selected ? slotKind(slots.selected) : undefined
              }
            />
          </div>

          <div className="bg-card rounded-lg border p-4 select-text">
            <GuideEditor
              summary={guideSummary}
              onSummaryChange={setGuideSummary}
              description={guideDescription}
              onDescriptionChange={setGuideDescription}
              buildSlug={isUpdate ? existingBuild?.slug : undefined}
            />
          </div>
        </div>
      </DragController>

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        initialVisibility={visibility}
        initialOrganizationId={organizationId}
        owner={{
          name: session?.user?.name ?? "You",
          username:
            (session?.user as { username?: string | null } | undefined)
              ?.username ?? null,
          image: session?.user?.image ?? null,
        }}
        organizations={organizations}
        confirmLabel={isUpdate ? "Update settings" : "Save build"}
        onConfirm={({ visibility: next, organizationId: nextOrgId }) => {
          setVisibility(next)
          setOrganizationId(nextOrgId)
          setPublishDialogOpen(false)
          if (!isUpdate) void performSave(next, nextOrgId)
        }}
      />

      {riven.dialog}
    </>
  )
}
