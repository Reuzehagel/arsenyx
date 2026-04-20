import { getArcanesForCategory } from "@arsenyx/shared/warframe/arcanes"
import { decodeBuild, encodeBuild } from "@arsenyx/shared/warframe/build-codec"
import { getModsForItem } from "@arsenyx/shared/warframe/mods"
import {
  createSyntheticRiven,
  isRivenEligible,
  isRivenMod,
} from "@arsenyx/shared/warframe/rivens"
import type { Mod } from "@arsenyx/shared/warframe/types"
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
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router"
import {
  Check,
  Diamond,
  Gem,
  Pencil,
  Settings2,
  Share2,
  UploadCloud,
  X,
} from "lucide-react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"

import {
  ArcaneRow,
  calculateCapacity,
  calculateFormaCount,
  calculateTotalEndoCost,
  getArcaneSlotCount,
  GuideEditor,
  hasAuraSlot,
  hasExilusSlot,
  ItemSidebar,
  ModGrid,
  ModSearchGrid,
  PublishDialog,
  RivenDialog,
  type PublishVisibility,
  toPolarity,
  useArcaneSlots,
  useBuildSlots,
  useSlotKeyboardNav,
  type ModSlotKind,
  type RivenDialogValues,
  type SlotId,
} from "@/components/build-editor"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { arcanesQuery } from "@/lib/arcanes-query"
import { authClient } from "@/lib/auth-client"
import {
  buildStateToSavedData,
  savedDataToBuildState,
} from "@/lib/build-codec-adapter"
import { buildQuery, type SavedBuildData } from "@/lib/build-query"
import { API_URL } from "@/lib/constants"
import { helminthQuery, type HelminthAbility } from "@/lib/helminth-query"
import { consumeDraft } from "@/lib/import-draft"
import { itemQuery } from "@/lib/item-query"
import { modsQuery } from "@/lib/mods-query"
import { myOrgsQuery } from "@/lib/org-query"
import { padShards, type PlacedShard } from "@/lib/shards"
import { isEditableTarget } from "@/lib/utils"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { formatVisibility } from "@/lib/user-display"
import {
  CATEGORIES,
  getImageUrl,
  isValidCategory,
  type BrowseCategory,
  type DetailItem,
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
        <div className="container px-4 py-4 md:py-6">
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
  const [draft] = useState(() => consumeDraft(draftId))
  const [shareHydrated] = useState(() => {
    if (!shareEncoded) return null
    const decoded = decodeBuild(shareEncoded)
    if (!decoded) return null
    return buildStateToSavedData(decoded, allMods, allArcanes)
  })
  const savedData: SavedBuildData = draft
    ? draft.data
    : existingBuild
      ? (existingBuild.buildData as SavedBuildData)
      : shareHydrated
        ? shareHydrated.data
        : ({} as SavedBuildData)

  const categoryLabel =
    CATEGORIES.find((c) => c.id === category)?.label ?? category

  const isCompanion = category === "companions"
  const normalSlotCount = 8
  const showAura = hasAuraSlot(category)
  const showExilus = hasExilusSlot(category)
  const slots = useBuildSlots(normalSlotCount, {
    placed: savedData.slots,
    formaPolarities: savedData.formaPolarities,
    showAura,
    showExilus,
  })
  useSlotKeyboardNav({
    slots,
    layout: { normalSlotCount, showAura, showExilus },
  })
  const arcaneCount = getArcaneSlotCount(category)
  const arcanes = useArcaneSlots(arcaneCount, savedData.arcanes)
  const arcaneOptions = useMemo(
    () => getArcanesForCategory(allArcanes, category),
    [allArcanes, category],
  )

  // Escape deselects the active mod/arcane slot, mirroring the
  // click-outside behavior. Skip when a dialog/popover is open (base-ui
  // closes those via its own Escape handler) or when typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (isEditableTarget(e.target)) return
      if (document.querySelector("[data-state='open'][role='dialog']")) return
      slots.select(null)
      arcanes.select(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [slots, arcanes])

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

  const [rivenEdit, setRivenEdit] = useState<{
    slotId: SlotId
    initial?: Partial<RivenDialogValues>
  } | null>(null)

  const openRivenForPlacement = () => {
    const target = findFreeNormalSlot(slots, normalSlotCount)
    if (!target) return
    setRivenEdit({ slotId: target, initial: undefined })
  }

  const openRivenForEdit = (slotId: SlotId) => {
    const placed = slots.placed[slotId]
    if (!placed) return
    setRivenEdit({
      slotId,
      initial: {
        polarity: placed.mod.polarity,
        drain: placed.mod.baseDrain,
        rivenStats: placed.mod.rivenStats,
      },
    })
  }

  const confirmRiven = (values: RivenDialogValues) => {
    if (!rivenEdit) return
    const base = createSyntheticRiven()
    const mod: Mod = {
      ...base,
      polarity: values.polarity,
      baseDrain: values.drain,
      rivenStats: values.rivenStats,
    }
    slots.placeAt(rivenEdit.slotId, mod, base.fusionLimit)
    setRivenEdit(null)
  }

  const handleModSelect = (mod: Mod) => {
    if (isRivenMod(mod)) {
      openRivenForPlacement()
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

  const auraRaw = Array.isArray(item.aura) ? item.aura[0] : item.aura
  const auraInnate = toPolarity(auraRaw)
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
        auraInnate,
        normalInnates,
        formaPolarities: slots.formaPolarities,
      }),
    [auraInnate, normalInnates, slots.formaPolarities],
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
      normalSlotCount,
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
        },
        guide: {
          summary: guideSummary.trim() || null,
          description: guideDescription.trim() || null,
        },
        ...(isUpdate
          ? {}
          : {
              itemUniqueName: item.uniqueName,
              itemCategory: category,
              itemName: item.name,
              itemImageName: item.imageName ?? null,
            }),
      }
      const url = isUpdate
        ? `${API_URL}/builds/${existingBuild!.slug}`
        : `${API_URL}/builds`
      const r = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "save_failed" }))
        throw new Error(err.error ?? "save_failed")
      }
      const { slug } = (await r.json()) as { id: string; slug: string }
      await queryClient.invalidateQueries({ queryKey: ["build", slug] })
      navigate({ to: "/builds/$slug", params: { slug } })
    } catch (err) {
      setSaveStatus("error")
      setSaveError(err instanceof Error ? err.message : "save_failed")
    }
  }

  const capacity = useMemo(
    () =>
      calculateCapacity({
        placed: slots.placed,
        formaPolarities: slots.formaPolarities,
        auraInnate,
        normalInnates,
        hasReactor,
      }),
    [
      slots.placed,
      slots.formaPolarities,
      auraInnate,
      normalInnates,
      hasReactor,
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

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:relative lg:block">
          <div className="bg-card w-full rounded-lg border lg:absolute lg:top-0 lg:bottom-0 lg:left-0 lg:w-[260px] lg:overflow-y-auto">
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
              placedMods={slots.placed}
              placedArcanes={arcanes.placed}
            />
          </div>

          <div
            className="bg-card min-w-0 flex-1 overflow-hidden rounded-lg border p-2 sm:p-4 lg:ml-[calc(260px+1rem)]"
            onClick={(e) => {
              if (!(e.target instanceof HTMLElement)) return
              if (!e.target.closest("[data-build-slot]")) {
                slots.select(null)
                arcanes.select(null)
              }
            }}
          >
            <ModGrid
              item={item}
              category={category}
              isCompanion={isCompanion}
              normalSlotCount={normalSlotCount}
              slots={slots}
              onEditRiven={openRivenForEdit}
              arcaneRow={
                arcaneCount > 0 ? (
                  <ArcaneRow
                    count={arcaneCount}
                    arcanes={arcanes}
                    options={arcaneOptions}
                  />
                ) : undefined
              }
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <SearchPanel
            item={item}
            category={category}
            usedModNames={slots.usedNames}
            onSelect={handleModSelect}
            selectedSlotKind={
              slots.selected === "aura" || slots.selected === "exilus"
                ? slots.selected
                : undefined
            }
          />
        </div>

        <div className="bg-card rounded-lg border p-4">
          <GuideEditor
            summary={guideSummary}
            onSummaryChange={setGuideSummary}
            description={guideDescription}
            onDescriptionChange={setGuideDescription}
          />
        </div>
      </div>

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

      {rivenEdit && (
        <RivenDialog
          key={rivenEdit.slotId}
          open={true}
          onOpenChange={(o) => {
            if (!o) setRivenEdit(null)
          }}
          category={category}
          initialValues={rivenEdit.initial}
          onConfirm={confirmRiven}
        />
      )}
    </>
  )
}

function EditorHeader({
  item,
  category,
  slug,
  buildSlug,
  categoryLabel,
  totalEndoCost,
  formaCount,
  buildName,
  onBuildNameChange,
  onSave,
  saveStatus,
  saveError,
  isSignedIn,
  settings,
  onShare,
  shareCopied,
}: {
  item: DetailItem
  category: BrowseCategory
  slug: string
  buildSlug?: string
  categoryLabel: string
  totalEndoCost: number
  formaCount: number
  buildName: string
  onBuildNameChange: (name: string) => void
  onSave: () => void
  saveStatus: "idle" | "saving" | "error"
  saveError: string | null
  isSignedIn: boolean
  settings?: { visibility: PublishVisibility; onEdit: () => void }
  onShare: () => void
  shareCopied: boolean
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setEditing(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }
  const commit = () => {
    const trimmed = buildName.trim()
    onBuildNameChange(trimmed || item.name)
    setEditing(false)
  }
  return (
    <div className="bg-card mb-4 rounded-lg border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="bg-muted/10 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md md:size-24">
            <img
              src={getImageUrl(item.imageName)}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <div className="flex items-center gap-2">
              {editing ? (
                <Input
                  ref={inputRef}
                  value={buildName}
                  onChange={(e) => onBuildNameChange(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit()
                    else if (e.key === "Escape") setEditing(false)
                  }}
                  className="h-8 text-xl font-bold tracking-tight md:text-2xl"
                />
              ) : (
                <>
                  <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:text-2xl">
                    {buildName}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Rename build"
                    onClick={startEdit}
                  >
                    <Pencil />
                  </Button>
                </>
              )}
            </div>
            <span className="text-muted-foreground text-sm">
              {item.name} · {categoryLabel}
            </span>
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
              >
                <Diamond className="size-3 fill-current" />
                {totalEndoCost.toLocaleString("en-US")}
              </Badge>
              {formaCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
                >
                  <Gem className="size-3" />
                  {formaCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "error" && saveError ? (
            <span className="text-destructive text-xs">{saveError}</span>
          ) : null}
          {settings && (
            <Button
              variant="outline"
              size="sm"
              onClick={settings.onEdit}
              title="Build settings"
            >
              <Settings2 data-icon="inline-start" />
              {formatVisibility(settings.visibility)}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            title="Copy shareable link"
          >
            {shareCopied ? (
              <>
                <Check data-icon="inline-start" />
                Copied
              </>
            ) : (
              <>
                <Share2 data-icon="inline-start" />
                Share
              </>
            )}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saveStatus === "saving"}>
            <UploadCloud data-icon="inline-start" />
            {saveStatus === "saving"
              ? "Saving…"
              : isSignedIn
                ? "Save"
                : "Save (sign in)"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              buildSlug ? (
                <RouterLink to="/builds/$slug" params={{ slug: buildSlug }} />
              ) : (
                <RouterLink
                  to="/browse/$category/$slug"
                  params={{ category, slug }}
                />
              )
            }
          >
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function SearchPanel({
  item,
  category,
  usedModNames,
  onSelect,
  selectedSlotKind,
}: {
  item: DetailItem
  category: BrowseCategory
  usedModNames: Set<string>
  onSelect: (mod: Mod) => void
  selectedSlotKind?: ModSlotKind
}) {
  const { data: allMods } = useSuspenseQuery(modsQuery)
  const compatible = useMemo(() => {
    const mods = getModsForItem(
      {
        type: item.type,
        category: item.category,
        name: item.name,
      },
      allMods,
    )
    if (isRivenEligible(category, item)) {
      return [createSyntheticRiven(), ...mods]
    }
    return mods
  }, [allMods, item.type, item.category, item.name, category])

  return (
    <ModSearchGrid
      mods={compatible}
      usedModNames={usedModNames}
      onSelect={onSelect}
      selectedSlotKind={selectedSlotKind}
    />
  )
}

function findFreeNormalSlot(
  slots: import("@/components/build-editor").BuildSlotsState,
  normalSlotCount: number,
): SlotId | null {
  if (
    slots.selected &&
    slots.selected !== "aura" &&
    slots.selected !== "exilus" &&
    !slots.placed[slots.selected]
  ) {
    return slots.selected
  }
  for (let i = 0; i < normalSlotCount; i++) {
    const id = `normal-${i}` as SlotId
    if (!slots.placed[id]) return id
  }
  return null
}
