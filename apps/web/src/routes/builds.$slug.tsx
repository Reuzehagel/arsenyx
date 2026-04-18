import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Diamond, Gem, Pencil } from "lucide-react";
import { Suspense, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import {
  ArcaneRow,
  calculateCapacity,
  calculateFormaCount,
  calculateTotalEndoCost,
  getArcaneSlotCount,
  ItemSidebar,
  ModGrid,
  toPolarity,
  useArcaneSlots,
  useBuildSlots,
} from "@/components/build-editor";
import { arcanesQuery } from "@/lib/arcanes-query";
import { getArcanesForCategory } from "@arsenyx/shared/warframe/arcanes";
import { buildQuery, type BuildDetail, type SavedBuildData } from "@/lib/build-query";
import { padShards } from "@/lib/shards";
import { slugify } from "@arsenyx/shared/warframe/slugs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { itemQuery } from "@/lib/item-query";
import {
  CATEGORIES,
  getImageUrl,
  isValidCategory,
  type BrowseCategory,
} from "@/lib/warframe";

export const Route = createFileRoute("/builds/$slug")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(buildQuery(params.slug)),
  component: BuildPage,
  notFoundComponent: BuildNotFound,
});

function BuildPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-4 md:py-6">
          <Suspense fallback={<p className="text-muted-foreground">Loading build…</p>}>
            <BuildViewer />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function BuildViewer() {
  const { slug } = Route.useParams();
  const { data: build } = useSuspenseQuery(buildQuery(slug));

  if (!isValidCategory(build.item.category)) {
    return <p className="text-muted-foreground">Unsupported category.</p>;
  }
  const category = build.item.category as BrowseCategory;
  const itemSlug = slugify(build.item.name);

  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading item…</p>}>
      <BuildViewerBody build={build} category={category} itemSlug={itemSlug} />
    </Suspense>
  );
}

function BuildViewerBody({
  build,
  category,
  itemSlug,
}: {
  build: BuildDetail;
  category: BrowseCategory;
  itemSlug: string;
}) {
  const { data: item } = useSuspenseQuery(itemQuery(category, itemSlug));
  const { data: allArcanes } = useSuspenseQuery(arcanesQuery);

  const saved = useMemo(
    () => (build.buildData ?? {}) as SavedBuildData,
    [build.buildData],
  );

  const categoryLabel =
    CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const isCompanion = category === "companions";
  const normalSlotCount = 8;
  const arcaneCount = getArcaneSlotCount(category);

  const arcaneOptions = useMemo(
    () => getArcanesForCategory(allArcanes, category),
    [allArcanes, category],
  );

  const slots = useBuildSlots(normalSlotCount, {
    placed: saved.slots,
    formaPolarities: saved.formaPolarities,
  });
  const arcanes = useArcaneSlots(arcaneCount, saved.arcanes);
  const shards = useMemo(() => padShards(saved.shards), [saved.shards]);
  const helminth = saved.helminth ?? {};
  const hasReactor = saved.hasReactor ?? true;

  const auraRaw = Array.isArray(item.aura) ? item.aura[0] : item.aura;
  const auraInnate = toPolarity(auraRaw);
  const normalInnates = useMemo(
    () =>
      Array.from({ length: normalSlotCount }, (_, i) =>
        toPolarity(item.polarities?.[i]),
      ),
    [item.polarities],
  );

  const totalEndoCost = useMemo(
    () => calculateTotalEndoCost(slots.placed),
    [slots.placed],
  );
  const formaCount = useMemo(
    () =>
      calculateFormaCount({
        auraInnate,
        normalInnates,
        formaPolarities: slots.formaPolarities,
      }),
    [auraInnate, normalInnates, slots.formaPolarities],
  );
  const capacity = useMemo(
    () =>
      calculateCapacity({
        placed: slots.placed,
        formaPolarities: slots.formaPolarities,
        auraInnate,
        normalInnates,
        hasReactor,
      }),
    [slots.placed, slots.formaPolarities, auraInnate, normalInnates, hasReactor],
  );

  const author =
    build.user.displayUsername ??
    build.user.username ??
    build.user.name ??
    "Anonymous";

  return (
    <>
      <ViewerHeader
        build={build}
        categoryLabel={categoryLabel}
        author={author}
        totalEndoCost={totalEndoCost}
        formaCount={formaCount}
        category={category}
        itemSlug={itemSlug}
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
              onToggleReactor={() => {}}
              shards={shards}
              onSetShard={() => {}}
              helminth={helminth}
              onSetHelminth={() => {}}
              placedMods={slots.placed}
              placedArcanes={arcanes.placed}
              readOnly
            />
          </div>

          <div className="bg-card min-w-0 flex-1 overflow-hidden rounded-lg border p-2 sm:p-4 lg:ml-[calc(260px+1rem)]">
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

        {build.guide?.description || build.guide?.summary ? (
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
  );
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
  build: BuildDetail;
  categoryLabel: string;
  author: string;
  totalEndoCost: number;
  formaCount: number;
  category: BrowseCategory;
  itemSlug: string;
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
              {build.item.name} · {categoryLabel} · by {author}
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
                {build.voteCount} votes · {build.viewCount} views
              </Badge>
              {build.visibility !== "PUBLIC" ? (
                <Badge variant="secondary" className="text-xs">
                  {build.visibility.toLowerCase()}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {build.isOwner ? (
            <Button
              size="sm"
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
        </div>
      </div>
    </div>
  );
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
  );
}
