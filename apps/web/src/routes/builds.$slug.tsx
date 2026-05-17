import { slugify } from "@arsenyx/shared/warframe/slugs"
import { getIncarnonBaseName } from "@arsenyx/shared/warframe/incarnon-data"
import {
  DEFAULT_DEPLOYMENT_CONTEXT,
  type LichBonusElement,
  type Mod,
} from "@arsenyx/shared/warframe/types"
import {
  getZawComponentImage,
  isZawStrike,
} from "@arsenyx/shared/warframe/zaw-data"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router"
import {
  Bookmark,
  Check,
  Code2,
  ExternalLink,
  GitFork,
  Heart,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Zap,
} from "lucide-react"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  ArcaneRow,
  calculateCapacity,
  calculateFormaCount,
  calculateTotalEndoCost,
  getArcaneSlotConfig,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { incarnonEvolutionsQuery } from "@/lib/incarnon-query"
import { itemQuery } from "@/lib/item-query"
import { modsQuery } from "@/lib/mods-query"
import {
  partnerBuildsQuery,
  type PartnerBuild,
} from "@/lib/partner-builds-query"
import { formatAbsoluteTime, relativeTime } from "@/lib/relative-time"
import {
  formatStatValue,
  getShardImageUrl,
  padShards,
  SHARD_COLOR_NAMES,
  SHARD_CSS_COLORS,
  SHARD_STATS,
  type PlacedShard,
} from "@/lib/shards"
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard"
import { authorName, formatVisibility } from "@/lib/user-display"
import { cn } from "@/lib/utils"
import {
  getCategoryLabel,
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

  const categoryLabel = getCategoryLabel(category)
  const isCompanion = category === "companions"
  const normalSlotCount = getNormalSlotCount(category)
  const arcaneCount = getArcaneSlotCount(category, item.type)

  const arcaneConfig = useMemo(
    () => getArcaneSlotConfig(allArcanes, category, arcaneCount, item),
    [allArcanes, category, arcaneCount, item],
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
  const deploymentContext =
    saved.deploymentContext ?? DEFAULT_DEPLOYMENT_CONTEXT

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
    deploymentContext,
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
        {embed && category === "warframes" && (
          <EmbedWarframeStrip
            abilities={item.abilities ?? []}
            helminth={helminth}
            shards={shards}
            slug={build.slug}
            itemName={item.name}
            itemImageName={item.imageName}
          />
        )}
        {embed &&
          category === "melee" &&
          isZawStrike(item.name) &&
          zawComponents && (
            <EmbedZawStrip
              itemName={item.name}
              itemImageName={item.imageName}
              grip={zawComponents.grip}
              link={zawComponents.link}
              slug={build.slug}
            />
          )}
        {embed && incarnonEnabled && incarnonPerks.some(Boolean) && (
          <Suspense fallback={null}>
            <EmbedIncarnonStrip
              weaponName={item.name}
              itemImageName={item.imageName}
              perks={incarnonPerks}
              slug={build.slug}
            />
          </Suspense>
        )}
        {embed && lichBonusElement !== null && (
          <EmbedLichStrip
            element={lichBonusElement}
            itemName={item.name}
            itemImageName={item.imageName}
            slug={build.slug}
          />
        )}
        <div
          className={cn(
            "flex flex-col gap-4",
            // At xl, switch to block + relative so the sidebar can be absolutely
            // positioned with top/bottom and inherit the loadout's height. That
            // gives ItemSidebar's inner `h-full` something concrete to fill so
            // its `xl:overflow-y-auto` triggers when stats are long.
            !embed && "xl:relative xl:block",
          )}
        >
          {!embed && (
            <div className="flex w-full flex-col sm:hidden xl:absolute xl:top-0 xl:bottom-0 xl:left-0 xl:flex xl:w-[260px]">
              <ItemSidebar {...sidebarProps} />
            </div>
          )}

          <div
            className={cn(
              "bg-card @container/loadout flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-lg border p-[clamp(0.5rem,1.5vw,1rem)]",
              !embed && "xl:ml-[calc(260px+1rem)]",
            )}
          >
            <ItemSidebarPopover
              {...sidebarProps}
              className={cn(
                "self-start",
                !embed && "hidden sm:inline-flex xl:hidden",
              )}
            />
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
                    arcanes={arcanes}
                    options={arcaneConfig.options}
                    labels={arcaneConfig.labels}
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

        {!embed ? <RelatedBuildsStrip slug={build.slug} /> : null}
      </div>
    </>
  )
}

function RelatedBuildsStrip({ slug }: { slug: string }) {
  const { data: partners } = useQuery(partnerBuildsQuery(slug))
  if (!partners || partners.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Related builds
      </h2>
      <ul className="flex flex-wrap gap-2">
        {partners.map((p) => (
          <li key={p.id}>
            <RelatedBuildChip build={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RelatedBuildChip({ build }: { build: PartnerBuild }) {
  return (
    <RouterLink
      to="/builds/$slug"
      params={{ slug: build.slug }}
      className="bg-card hover:bg-card/70 inline-flex items-center gap-2 rounded-md border py-1 pr-3 pl-1 transition-colors"
    >
      <span className="bg-muted/40 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded">
        <img
          src={getImageUrl(build.item.imageName ?? undefined)}
          alt=""
          className="size-full object-contain"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="max-w-[20ch] truncate text-xs font-medium">
          {build.name}
        </span>
        <span className="text-muted-foreground max-w-[20ch] truncate text-[11px]">
          {build.item.name}
        </span>
      </span>
    </RouterLink>
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
              <RouterLink
                to="/browse/$category/$slug"
                params={{ category, slug: itemSlug }}
                className="hover:text-foreground hover:underline"
              >
                {build.item.name}
              </RouterLink>
              {" · "}
              <RouterLink
                to="/browse"
                search={{ category }}
                className="hover:text-foreground hover:underline"
              >
                {categoryLabel}
              </RouterLink>
              {" · "}
              {build.organization ? (
                <RouterLink
                  to="/org/$slug"
                  params={{ slug: build.organization.slug }}
                  className="text-[#a78bfa] hover:underline"
                >
                  {build.organization.name}
                </RouterLink>
              ) : build.user.username ? (
                <>
                  by{" "}
                  <RouterLink
                    to="/profile/$username"
                    params={{ username: build.user.username }}
                    className="hover:text-foreground hover:underline"
                  >
                    {author}
                  </RouterLink>
                </>
              ) : (
                <>by {author}</>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
              >
                <img
                  src="/icons/currency/Endo.png"
                  alt=""
                  aria-hidden
                  className="size-4"
                />
                {totalEndoCost.toLocaleString("en-US")}
              </Badge>
              {formaCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
                >
                  <img
                    src="/icons/currency/Forma.png"
                    alt=""
                    aria-hidden
                    className="size-[18px] object-contain"
                  />
                  {formaCount}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {build.likeCount} likes · {build.viewCount} views
              </Badge>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge variant="outline" className="text-xs">
                      Updated {relativeTime(build.updatedAt)}
                    </Badge>
                  }
                />
                <TooltipContent>
                  Updated {formatAbsoluteTime(build.updatedAt)}
                </TooltipContent>
              </Tooltip>
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
          <ShareMenu slug={build.slug} />
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

function ShareMenu({ slug }: { slug: string }) {
  const { copied, copy } = useCopyToClipboard()
  const buildUrl = () => `${window.location.origin}/builds/${slug}`
  const onCopyLink = () => copy(buildUrl())
  const onCopyEmbed = () =>
    copy(
      `<iframe src="${buildUrl()}?embed=1" style="width:100%;border:none" height="1" loading="lazy"></iframe>`,
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="outline" title="Share" />}
      >
        {copied ? (
          <Check data-icon="inline-start" className="text-green-500" />
        ) : (
          <Share2 data-icon="inline-start" />
        )}
        {copied ? "Copied!" : "Share"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onClick={onCopyLink}>
          <Link2 className="size-4" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyEmbed}>
          <Code2 className="size-4" />
          Copy embed code
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

function EmbedWarframeStrip({
  abilities,
  helminth,
  shards,
  slug,
  itemName,
  itemImageName,
}: {
  abilities: Array<{ name: string; description: string; imageName?: string }>
  helminth: Record<number, HelminthAbility>
  shards: (PlacedShard | null)[]
  slug: string
  itemName: string
  itemImageName?: string
}) {
  const buildUrl = `${window.location.origin}/builds/${slug}`
  const hasAbilities = abilities.length > 0
  const hasShards = shards.some(Boolean)
  if (!hasAbilities && !hasShards) return null

  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex shrink-0 items-center gap-2">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {itemName}
        </span>
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 md:w-auto md:flex-1">
        {hasAbilities && (
          <div className="flex shrink-0 items-center gap-1.5">
            {abilities.slice(0, 4).map((a, i) => {
              const replaced = helminth[i]
              const displayed = replaced
                ? {
                    name: replaced.name,
                    description: replaced.description,
                    imageName: replaced.imageName,
                  }
                : a
              return (
                <EmbedAbilityIcon
                  key={i}
                  ability={displayed}
                  isHelminth={Boolean(replaced)}
                />
              )
            })}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {shards.slice(0, 5).map((shard, i) => (
            <EmbedShardSlot key={i} shard={shard} />
          ))}
        </div>
      </div>
      <a
        href={buildUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
      >
        View on Arsenyx
        <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

function EmbedAbilityIcon({
  ability,
  isHelminth,
}: {
  ability: { name: string; description: string; imageName?: string }
  isHelminth: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerEl = (
    <button
      type="button"
      className={cn(
        "bg-muted relative size-10 overflow-hidden rounded-sm border",
        isHelminth ? "border-destructive/60" : "border-border",
      )}
    >
      {ability.imageName ? (
        <img
          src={getImageUrl(ability.imageName)}
          alt={ability.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center">
          <Zap className="size-4" />
        </div>
      )}
    </button>
  )
  const tooltipContent = (
    <>
      <p className="font-semibold">
        {ability.name}
        {isHelminth && (
          <span className="text-destructive ml-1 text-[10px]">(Helminth)</span>
        )}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {ability.description}
      </p>
    </>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={triggerEl} />} />
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="max-w-xs p-3">
        {tooltipContent}
      </PopoverContent>
    </Popover>
  )
}

function EmbedShardSlot({ shard }: { shard: PlacedShard | null }) {
  const [open, setOpen] = useState(false)
  const stat = shard
    ? (SHARD_STATS[shard.color].find((s) => s.name === shard.stat) ?? null)
    : null
  const triggerEl = (
    <div
      className={cn(
        "relative flex size-10 items-center justify-center rounded-sm border",
        shard
          ? "bg-muted/40 border-border"
          : "border-muted-foreground/10 border-dashed",
      )}
    >
      {shard ? (
        <img
          src={getShardImageUrl(shard.color, shard.tauforged)}
          alt=""
          className="size-9"
        />
      ) : (
        <Plus className="text-muted-foreground/20 size-4" />
      )}
    </div>
  )
  return (
    <Popover open={open} onOpenChange={shard ? setOpen : undefined}>
      <Tooltip>
        <TooltipTrigger
          render={shard ? <PopoverTrigger render={triggerEl} /> : triggerEl}
        />
        <TooltipContent side="bottom">
          {shard ? (
            <>
              <p className="font-semibold">
                {shard.tauforged ? "Tauforged " : ""}
                <span style={{ color: SHARD_CSS_COLORS[shard.color] }}>
                  {SHARD_COLOR_NAMES[shard.color]}
                </span>
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {shard.stat}
                {stat ? ` · ${formatStatValue(stat, shard.tauforged)}` : ""}
              </p>
            </>
          ) : (
            <span className="text-muted-foreground">Empty shard slot</span>
          )}
        </TooltipContent>
      </Tooltip>
      {shard && (
        <PopoverContent side="bottom" align="center" className="w-64 p-3">
          <div className="flex items-center gap-2.5">
            <img
              src={getShardImageUrl(shard.color, shard.tauforged)}
              alt=""
              className="size-10 shrink-0"
            />
            <div>
              <p className="text-sm font-semibold">
                {shard.tauforged ? "Tauforged " : ""}
                <span style={{ color: SHARD_CSS_COLORS[shard.color] }}>
                  {SHARD_COLOR_NAMES[shard.color]}
                </span>
              </p>
              <p className="text-muted-foreground text-xs">
                {shard.stat}
                {stat ? ` · ${formatStatValue(stat, shard.tauforged)}` : ""}
              </p>
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}

// ─── Zaw strip ───────────────────────────────────────────────────────────────

function EmbedZawStrip({
  itemName,
  itemImageName,
  grip,
  link,
  slug,
}: {
  itemName: string
  itemImageName?: string
  grip: string
  link: string
  slug: string
}) {
  const buildUrl = `${window.location.origin}/builds/${slug}`
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex items-center gap-2 md:flex-1">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {itemName}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <EmbedZawPart name={grip} type="Grip" />
        <EmbedZawPart name={link} type="Link" />
      </div>
      <div className="flex md:flex-1 md:justify-end">
        <a
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
        >
          View on Arsenyx
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}

function EmbedZawPart({ name, type }: { name: string; type: "Grip" | "Link" }) {
  const [open, setOpen] = useState(false)
  const imageName = getZawComponentImage(name)
  const triggerEl = (
    <button
      type="button"
      className="bg-muted relative flex size-10 items-center justify-center overflow-hidden rounded-sm border"
    >
      {imageName ? (
        <img
          src={getImageUrl(imageName)}
          alt={name}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-muted-foreground px-0.5 text-center text-[9px] font-medium leading-tight">
          {name}
        </span>
      )}
    </button>
  )
  const content = (
    <>
      <p className="font-semibold">{name}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{type}</p>
    </>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={triggerEl} />} />
        <TooltipContent side="bottom">{content}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="p-3">
        {content}
      </PopoverContent>
    </Popover>
  )
}

// ─── Incarnon evo strip ───────────────────────────────────────────────────────

function EmbedIncarnonStrip({
  weaponName,
  itemImageName,
  perks,
  slug,
}: {
  weaponName: string
  itemImageName?: string
  perks: (string | null)[]
  slug: string
}) {
  const { data: evolutions } = useSuspenseQuery(incarnonEvolutionsQuery)
  const baseName = getIncarnonBaseName(weaponName)
  const evolution = baseName ? evolutions[baseName] : undefined
  if (!evolution) return null
  const choosableTiers = evolution.tiers.filter((t) => t.perks.length > 1)
  if (choosableTiers.length === 0) return null

  const buildUrl = `${window.location.origin}/builds/${slug}`
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex items-center gap-2 md:flex-1">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={weaponName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {weaponName}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {choosableTiers.map((tier) => {
          const picked =
            tier.perks.find((p) => p.name === (perks[tier.tier - 1] ?? null)) ??
            null
          return (
            <EmbedIncarnonTier key={tier.tier} tier={tier.tier} picked={picked} />
          )
        })}
      </div>
      <div className="flex md:flex-1 md:justify-end">
        <a
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
        >
          View on Arsenyx
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}

function EmbedIncarnonTier({
  tier,
  picked,
}: {
  tier: number
  picked: { name: string; description: string } | null
}) {
  const [open, setOpen] = useState(false)
  const triggerEl = (
    <button
      type="button"
      className={cn(
        "relative flex size-10 items-center justify-center rounded-sm border text-xs font-semibold tabular-nums",
        picked
          ? "bg-muted/40 border-border text-foreground"
          : "border-muted-foreground/10 text-muted-foreground/40 border-dashed",
      )}
    >
      T{tier}
    </button>
  )
  const tooltipContent = picked ? (
    <>
      <p className="font-semibold">{picked.name}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{picked.description}</p>
    </>
  ) : (
    <span className="text-muted-foreground">Tier {tier} — not selected</span>
  )
  return (
    <Popover open={open} onOpenChange={picked ? setOpen : undefined}>
      <Tooltip>
        <TooltipTrigger
          render={picked ? <PopoverTrigger render={triggerEl} /> : triggerEl}
        />
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
      {picked && (
        <PopoverContent side="bottom" align="center" className="max-w-xs p-3">
          {tooltipContent}
        </PopoverContent>
      )}
    </Popover>
  )
}

// ─── Lich element strip ───────────────────────────────────────────────────────

const LICH_ELEMENT_ICON: Record<string, string> = {
  Heat: "/icons/damage/HeatSymbol.png",
  Cold: "/icons/damage/ColdSymbol.png",
  Electricity: "/icons/damage/ElectricitySymbol.png",
  Toxin: "/icons/damage/ToxinSymbol.png",
  Radiation: "/icons/damage/RadiationSymbol.png",
  Magnetic: "/icons/damage/MagneticSymbol.png",
  Impact: "/icons/damage/ImpactSymbol.png",
}

function EmbedLichStrip({
  element,
  itemName,
  itemImageName,
  slug,
}: {
  element: LichBonusElement
  itemName: string
  itemImageName?: string
  slug: string
}) {
  const buildUrl = `${window.location.origin}/builds/${slug}`
  const iconPath = LICH_ELEMENT_ICON[element]
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex items-center gap-2 md:flex-1">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {itemName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {iconPath && (
          <img src={iconPath} alt="" aria-hidden className="size-5 shrink-0" />
        )}
        <span className="text-sm font-medium">+60% {element}</span>
      </div>
      <div className="flex md:flex-1 md:justify-end">
        <a
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
        >
          View on Arsenyx
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
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
