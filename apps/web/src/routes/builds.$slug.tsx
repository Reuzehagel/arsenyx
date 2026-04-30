import { getArcanesForCategory } from "@arsenyx/shared/warframe/arcanes"
import { slugify } from "@arsenyx/shared/warframe/slugs"
import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router"
import {
  Bookmark,
  Check,
  Code2,
  Diamond,
  Gem,
  GitFork,
  Heart,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  ArcaneRow,
  calculateCapacity,
  calculateFormaCount,
  calculateTotalEndoCost,
  getArcaneSlotCount,
  getAuraPolarities,
  getAuraSlotCount,
  getExilusInnatePolarity,
  getMaxLevelCap,
  getNormalSlotCount,
  hasExilusSlot,
  ItemSidebar,
  ItemSidebarPopover,
  ModGrid,
  toPolarity,
  useArcaneSlots,
  useBuildSlots,
} from "@/components/build-editor"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { arcanesQuery } from "@/lib/arcanes-query"
import { authClient } from "@/lib/auth-client"
import { useDeleteBuild, useForkBuild } from "@/lib/build-actions"
import {
  isLegacyBuildData,
  normalizeBuildData,
} from "@/lib/build-codec-adapter"
import { buildQuery, type BuildDetail } from "@/lib/build-query"
import { useToggleBookmark, useToggleLike } from "@/lib/build-social"
import { helminthQuery, type HelminthAbility } from "@/lib/helminth-query"
import { itemQuery } from "@/lib/item-query"
import { modsQuery } from "@/lib/mods-query"
import { padShards } from "@/lib/shards"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { authorName, formatVisibility } from "@/lib/user-display"
import { cn } from "@/lib/utils"
import {
  CATEGORIES,
  getImageUrl,
  isValidCategory,
  type BrowseCategory,
} from "@/lib/warframe"

interface BuildSearch {
  /** When true, render a chrome-less view suitable for embedding. */
  embed?: boolean
  /** CSS zoom multiplier applied to the whole embed (e.g. 0.9 = 90%).
   *  Shrinks everything uniformly while wrap-query reflow still works
   *  (mods wrap at narrow widths). */
  scale?: number
  /** Optional background colour (CSS value without #, e.g. `22272e`).
   *  Applied to the iframe body so the embed blends with the host page. */
  bg?: string
}

export const Route = createFileRoute("/builds/$slug")({
  validateSearch: (s: Record<string, unknown>): BuildSearch => {
    const embed = s.embed === true || s.embed === "1" || s.embed === "true"
    const num = (v: unknown) => {
      const n = typeof v === "string" ? Number(v) : v
      return typeof n === "number" && Number.isFinite(n) ? n : undefined
    }
    const rawScale = num(s.scale)
    const scale =
      rawScale !== undefined ? Math.min(2, Math.max(0.1, rawScale)) : undefined
    const bg = typeof s.bg === "string" && s.bg.length > 0 ? s.bg : undefined
    return {
      ...(embed && { embed }),
      ...(scale !== undefined && { scale }),
      ...(bg !== undefined && { bg }),
    }
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(buildQuery(params.slug)),
  component: BuildPage,
  notFoundComponent: BuildNotFound,
})

function BuildPage() {
  const { embed, scale, bg } = Route.useSearch()

  if (embed) {
    return (
      <EmbedShell scale={scale} bg={bg}>
        <Suspense
          fallback={<p className="text-muted-foreground">Loading build…</p>}
        >
          <BuildViewer embed />
        </Suspense>
      </EmbedShell>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="wrap py-4 md:py-6">
          <Suspense
            fallback={<p className="text-muted-foreground">Loading build…</p>}
          >
            <BuildViewer />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

/**
 * Embed wrapper. Fires postMessage so host pages can auto-resize the iframe
 * to the exact content height. The `bg` param sets body background to blend
 * the embed with the host page.
 *
 * `scale` applies CSS `zoom` globally (e.g. 0.9 = 90%). Because `zoom`
 * affects layout, wrap-query responsive reflow still works — mods wrap
 * at narrow widths just as they do without scaling.
 */
function EmbedShell({
  scale,
  bg,
  children,
}: {
  scale?: number
  bg?: string
  children: React.ReactNode
}) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [innerH, setInnerH] = useState<number | null>(null)
  const zoom = scale ?? 1

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (typeof h !== "number") return
      const r = Math.ceil(h)
      setInnerH((prev) => (prev === r ? prev : r))
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (innerH === null) return
    window.parent.postMessage(
      { type: "arsenyx-embed-resize", height: Math.ceil(innerH * zoom) },
      "*",
    )
  }, [innerH, zoom])

  const bgColor = bg ? (bg.startsWith("#") ? bg : `#${bg}`) : undefined

  return (
    <div
      ref={innerRef}
      className="bg-background w-full"
      style={{
        ...(zoom !== 1 && { zoom }),
        ...(bgColor && { backgroundColor: bgColor }),
      }}
    >
      {children}
    </div>
  )
}

function BuildViewer({ embed = false }: { embed?: boolean }) {
  const { slug } = Route.useParams()
  const { data: build } = useSuspenseQuery(buildQuery(slug))

  if (!isValidCategory(build.item.category)) {
    return <p className="text-muted-foreground">Unsupported category.</p>
  }
  const category = build.item.category as BrowseCategory
  const itemSlug = slugify(build.item.name)

  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading item…</p>}>
      <BuildViewerBody
        build={build}
        category={category}
        itemSlug={itemSlug}
        embed={embed}
      />
    </Suspense>
  )
}

function BuildViewerBody(props: {
  build: BuildDetail
  category: BrowseCategory
  itemSlug: string
  embed: boolean
}) {
  // New-format builds (SavedBuildData) carry full mod/arcane objects inline in
  // buildData, so we skip the ~1.35MB mods-all.json + arcanes-all.json fetches.
  // Only legacy BuildState-shape builds need the catalogs for uniqueName lookup
  // and image refresh (older wfcd hashed-slug filenames now 404 on the CDN).
  if (isLegacyBuildData(props.build.buildData)) {
    return <BuildViewerBodyWithCatalog {...props} />
  }
  return (
    <BuildViewerBodyInner
      {...props}
      allMods={[]}
      allArcanes={[]}
      helminthAbilities={[]}
    />
  )
}

function BuildViewerBodyWithCatalog(props: {
  build: BuildDetail
  category: BrowseCategory
  itemSlug: string
  embed: boolean
}) {
  const { data: allArcanes } = useSuspenseQuery(arcanesQuery)
  const { data: allMods } = useSuspenseQuery(modsQuery)
  const { data: helminthAbilities } = useSuspenseQuery(helminthQuery)
  return (
    <BuildViewerBodyInner
      {...props}
      allMods={allMods}
      allArcanes={allArcanes}
      helminthAbilities={helminthAbilities}
    />
  )
}

function BuildViewerBodyInner({
  build,
  category,
  itemSlug,
  allMods,
  allArcanes,
  helminthAbilities,
  embed,
}: {
  build: BuildDetail
  category: BrowseCategory
  itemSlug: string
  allMods: Mod[]
  allArcanes: Arcane[]
  helminthAbilities: HelminthAbility[]
  embed: boolean
}) {
  const { data: item } = useSuspenseQuery(itemQuery(category, itemSlug))

  const saved = useMemo(
    () =>
      normalizeBuildData(
        build.buildData,
        allMods,
        allArcanes,
        helminthAbilities,
      ),
    [build.buildData, allMods, allArcanes, helminthAbilities],
  )

  const categoryLabel =
    CATEGORIES.find((c) => c.id === category)?.label ?? category
  const isCompanion = category === "companions"
  const normalSlotCount = getNormalSlotCount(category)
  const arcaneCount = getArcaneSlotCount(category)

  const arcaneOptions = useMemo(
    () => getArcanesForCategory(allArcanes, category),
    [allArcanes, category],
  )

  const auraSlotCount = getAuraSlotCount(category, item)
  const slots = useBuildSlots(normalSlotCount, {
    placed: saved.slots,
    formaPolarities: saved.formaPolarities,
    auraSlotCount,
    showExilus: hasExilusSlot(category),
    initialSelected: null,
  })
  const arcanes = useArcaneSlots(arcaneCount, saved.arcanes)
  const shards = useMemo(() => padShards(saved.shards), [saved.shards])
  const helminth = saved.helminth ?? {}
  const hasReactor = saved.hasReactor ?? true
  const zawComponents = saved.zawComponents
  const lichBonusElement = saved.lichBonusElement ?? null
  const incarnonEnabled = saved.incarnonEnabled ?? false
  const incarnonPerks = saved.incarnonPerks ?? []

  const auraInnates = useMemo(
    () => getAuraPolarities(item, auraSlotCount),
    [item, auraSlotCount],
  )
  const exilusInnate = useMemo(() => getExilusInnatePolarity(item), [item])
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
        normalInnates,
        formaPolarities: slots.formaPolarities,
      }),
    [auraInnates, exilusInnate, normalInnates, slots.formaPolarities],
  )
  const capacity = useMemo(
    () =>
      calculateCapacity({
        placed: slots.placed,
        formaPolarities: slots.formaPolarities,
        auraInnates,
        exilusInnate,
        normalInnates,
        hasReactor,
        maxLevelCap: getMaxLevelCap(category, item),
      }),
    [
      slots.placed,
      slots.formaPolarities,
      auraInnates,
      exilusInnate,
      normalInnates,
      hasReactor,
      category,
      item,
    ],
  )

  const author = authorName(build.user)

  const sidebarProps = {
    item,
    category,
    capacityUsed: capacity.used,
    capacityMax: capacity.max,
    hasReactor,
    onToggleReactor: () => {},
    shards,
    onSetShard: () => {},
    helminth,
    onSetHelminth: () => {},
    zawComponents,
    lichBonusElement,
    incarnonEnabled,
    incarnonPerks,
    placedMods: slots.placed,
    placedArcanes: arcanes.placed,
    readOnly: true as const,
  }

  return (
    <>
      {!embed && (
        <ViewerHeader
          build={build}
          categoryLabel={categoryLabel}
          author={author}
          totalEndoCost={totalEndoCost}
          formaCount={formaCount}
          category={category}
          itemSlug={itemSlug}
        />
      )}

      <div className="flex flex-col gap-4">
        <div
          data-screenshot-target
          className={cn("flex flex-col gap-4", !embed && "md:flex-row")}
        >
          {!embed && (
            <div className="flex w-full flex-col md:w-[260px] md:shrink-0">
              <ItemSidebar {...sidebarProps} />
            </div>
          )}

          <div className="bg-card @container/loadout flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border p-[clamp(0.5rem,1.5vw,1rem)]">
            {embed && (
              <ItemSidebarPopover {...sidebarProps} className="self-start" />
            )}
            <ModGrid
              item={item}
              category={category}
              isCompanion={isCompanion}
              normalSlotCount={normalSlotCount}
              slots={slots}
              readOnly
              arcaneRow={
                arcaneCount > 0 ? (
                  <ArcaneRow
                    count={arcaneCount}
                    arcanes={arcanes}
                    options={arcaneOptions}
                    readOnly
                  />
                ) : undefined
              }
            />
          </div>
        </div>

        {!embed && (build.guide?.description || build.guide?.summary) ? (
          <div className="bg-card rounded-lg border p-4">
            {build.guide.summary ? (
              <p className="mb-3 font-medium">{build.guide.summary}</p>
            ) : null}
            {build.guide.description ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {build.guide.description}
                </ReactMarkdown>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}

function ViewerHeader({
  build,
  categoryLabel,
  author,
  totalEndoCost,
  formaCount,
  category,
  itemSlug,
}: {
  build: BuildDetail
  categoryLabel: string
  author: string
  totalEndoCost: number
  formaCount: number
  category: BrowseCategory
  itemSlug: string
}) {
  return (
    <div className="bg-card mb-4 rounded-lg border p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="bg-muted/10 relative flex size-[clamp(4rem,8vw,6rem)] shrink-0 items-center justify-center overflow-hidden rounded-md">
            {build.item.imageName ? (
              <img
                src={getImageUrl(build.item.imageName)}
                alt={build.item.name}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <h1 className="truncate text-[clamp(1.25rem,2vw,1.5rem)] leading-tight font-bold tracking-tight">
              {build.name}
            </h1>
            <span className="text-muted-foreground text-sm">
              {build.item.name} · {categoryLabel} ·{" "}
              {build.organization ? (
                <RouterLink
                  to="/org/$slug"
                  params={{ slug: build.organization.slug }}
                  className="text-[#a78bfa] hover:underline"
                >
                  {build.organization.name}
                </RouterLink>
              ) : (
                <>by {author}</>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
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
              <Badge variant="outline" className="text-xs">
                {build.likeCount} likes · {build.viewCount} views
              </Badge>
              {build.visibility !== "PUBLIC" ? (
                <Badge variant="secondary" className="text-xs">
                  {formatVisibility(build.visibility)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SocialActions build={build} />
          <CopyEmbedButton slug={build.slug} />
          {build.isOwner ? (
            <Button
              size="sm"
              nativeButton={false}
              render={
                <RouterLink
                  to="/create"
                  search={{ category, item: itemSlug, build: build.slug }}
                />
              }
            >
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          ) : null}
          <BuildActionsMenu
            slug={build.slug}
            name={build.name}
            isOwner={build.isOwner}
          />
        </div>
      </div>
    </div>
  )
}

function BuildActionsMenu({
  slug,
  name,
  isOwner,
}: {
  slug: string
  name: string
  isOwner: boolean
}) {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const fork = useForkBuild(slug)
  const del = useDeleteBuild(slug)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const onFork = () => {
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    fork.mutate(undefined, {
      onSuccess: ({ slug: newSlug }) => {
        navigate({ to: "/builds/$slug", params: { slug: newSlug } })
      },
    })
  }

  const onDelete = () => {
    del.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false)
        navigate({ to: "/builds/mine" })
      },
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="More actions" />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={onFork} disabled={fork.isPending}>
            <GitFork className="size-4" />
            {fork.isPending ? "Forking…" : "Fork"}
          </DropdownMenuItem>
          {isOwner ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this build?</DialogTitle>
            <DialogDescription>
              This permanently removes “{name}”. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CopyEmbedButton({ slug }: { slug: string }) {
  const { copied, copy } = useCopyToClipboard()
  const [hovered, setHovered] = useState(false)
  const handleCopy = () => {
    const src = `${window.location.origin}/builds/${slug}?embed=1`
    copy(
      `<iframe src="${src}" style="width:100%;border:none" height="1" loading="lazy"></iframe>`,
    )
  }
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleCopy}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Copy embed code"
    >
      {copied ? (
        <Check data-icon="inline-start" className="text-green-500" />
      ) : (
        <Code2 data-icon="inline-start" />
      )}
      <span className="inline-block w-[3.25rem] text-center">
        {copied ? "Copied!" : hovered ? "Copy" : "Embed"}
      </span>
    </Button>
  )
}

function SocialActions({ build }: { build: BuildDetail }) {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const like = useToggleLike(build.slug)
  const bookmark = useToggleBookmark(build.slug)
  const isOwner = build.isOwner

  const requireAuthThen = (run: () => void) => () => {
    if (!session?.user) {
      navigate({ to: "/auth/signin" })
      return
    }
    run()
  }

  const onLike = requireAuthThen(() => like.mutate(!build.viewerHasLiked))
  const onBookmark = requireAuthThen(() =>
    bookmark.mutate(!build.viewerHasBookmarked),
  )

  return (
    <>
      <Button
        size="sm"
        variant={build.viewerHasLiked ? "default" : "outline"}
        onClick={onLike}
        disabled={isOwner || like.isPending}
        aria-pressed={build.viewerHasLiked}
        title={isOwner ? "You can't like your own build" : undefined}
      >
        <Heart
          data-icon="inline-start"
          className={cn(build.viewerHasLiked && "fill-current")}
        />
        <span className="tabular-nums">{build.likeCount}</span>
      </Button>
      <Button
        size="sm"
        variant={build.viewerHasBookmarked ? "default" : "outline"}
        onClick={onBookmark}
        disabled={bookmark.isPending}
        aria-pressed={build.viewerHasBookmarked}
      >
        <Bookmark
          data-icon="inline-start"
          className={cn(build.viewerHasBookmarked && "fill-current")}
        />
        <span className="tabular-nums">{build.bookmarkCount}</span>
      </Button>
    </>
  )
}

function BuildNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <h1 className="text-2xl font-semibold">Build not found</h1>
        <p className="text-muted-foreground">
          This build may have been deleted or is private.
        </p>
      </main>
      <Footer />
    </div>
  )
}
