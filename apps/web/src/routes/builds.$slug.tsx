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
import { authorName, formatVisibility } from "@/lib/user-display"
import { cn } from "@/lib/utils"
import {
  CATEGORIES,
  getImageUrl,
  isValidCategory,
  type BrowseCategory,
} from "@/lib/warframe"

interface BuildSearch {
  /** When true, render a chrome-less view suitable for embedding (e.g. the
   *  Profit-Taker wiki). Hides the site header/footer, viewer header, and
   *  guide block. */
  embed?: boolean
  /** Visual scale factor applied to the embed. Defaults to 0.65 — sized to
   *  fit comfortably in a ~700px iframe (the PT wiki's Nuxt embed width). */
  scale?: number
  /** Logical layout width (px) the embed renders at internally before
   *  scaling. Kept ≥ 1024 by default so the dense single-row mod layout
   *  triggers; the visible width is `layout * scale`. */
  layout?: number
}

export const Route = createFileRoute("/builds/$slug")({
  validateSearch: (s: Record<string, unknown>): BuildSearch => {
    const embed = s.embed === true || s.embed === "1" || s.embed === "true"
    const num = (v: unknown) => {
      const n = typeof v === "string" ? Number(v) : v
      return typeof n === "number" && Number.isFinite(n) ? n : undefined
    }
    const rawScale = num(s.scale)
    const rawLayout = num(s.layout)
    const scale =
      rawScale !== undefined
        ? Math.min(1.5, Math.max(0.3, rawScale))
        : undefined
    const layout =
      rawLayout !== undefined
        ? Math.min(2000, Math.max(640, Math.round(rawLayout)))
        : undefined
    return {
      ...(embed && { embed }),
      ...(scale !== undefined && { scale }),
      ...(layout !== undefined && { layout }),
    }
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(buildQuery(params.slug)),
  component: BuildPage,
  notFoundComponent: BuildNotFound,
})

function BuildPage() {
  const { embed, scale, layout } = Route.useSearch()

  if (embed) {
    return (
      <EmbedShell scale={scale ?? 0.65} layoutWidth={layout ?? 1140}>
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
        <div className="container px-4 py-4 md:py-6">
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
 * Embed wrapper that forces the build view to lay out at a fixed logical
 * width (so the dense single-row mod layout triggers via container queries)
 * then visually scales the result down to fit a smaller iframe. A
 * ResizeObserver mirrors the inner element's height back to the wrapper so
 * the iframe content doesn't have a giant whitespace gutter.
 */
function EmbedShell({
  scale,
  layoutWidth,
  children,
}: {
  scale: number
  layoutWidth: number
  children: React.ReactNode
}) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [innerHeight, setInnerHeight] = useState<number | null>(null)

  useEffect(() => {
    const node = innerRef.current
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (typeof h !== "number") return
      const rounded = Math.ceil(h)
      setInnerHeight((prev) => (prev === rounded ? prev : rounded))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      className="bg-background overflow-hidden"
      style={{
        width: layoutWidth * scale,
        height: innerHeight !== null ? innerHeight * scale : undefined,
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: layoutWidth,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
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
          className={cn(
            "flex flex-col gap-4",
            embed ? "flex-row" : "xl:relative xl:block",
          )}
        >
          <div
            className={cn(
              "flex w-full flex-col",
              embed
                ? "w-[260px] shrink-0"
                : "sm:hidden xl:absolute xl:top-0 xl:bottom-0 xl:left-0 xl:flex xl:w-[260px]",
            )}
          >
            <ItemSidebar {...sidebarProps} />
          </div>

          <div
            className={cn(
              "bg-card @container/loadout flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border p-2 sm:p-4",
              !embed && "xl:ml-[calc(260px+1rem)]",
            )}
          >
            {!embed && (
              <ItemSidebarPopover
                {...sidebarProps}
                className="hidden self-start sm:inline-flex xl:hidden"
              />
            )}
            <ModGrid
              item={item}
              category={category}
              isCompanion={isCompanion}
              normalSlotCount={normalSlotCount}
              slots={slots}
              readOnly
              embed={embed}
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
          <div className="bg-muted/10 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md md:size-24">
            {build.item.imageName ? (
              <img
                src={getImageUrl(build.item.imageName)}
                alt={build.item.name}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-2">
            <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:text-2xl">
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
      <main className="container flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <h1 className="text-2xl font-semibold">Build not found</h1>
        <p className="text-muted-foreground">
          This build may have been deleted or is private.
        </p>
      </main>
      <Footer />
    </div>
  )
}
