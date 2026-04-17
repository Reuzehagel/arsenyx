import {
  createFileRoute,
  redirect,
  Link as RouterLink,
} from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Diamond, Gem, Pencil, UploadCloud, X } from "lucide-react";
import { Suspense, useMemo, useRef, useState } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import {
  ArcaneSlot,
  calculateCapacity,
  calculateFormaCount,
  calculateTotalEndoCost,
  CANONICAL_POLARITIES,
  getArcaneSlotCount,
  ItemSidebar,
  ModSearchGrid,
  ModSlot,
  useBuildSlots,
  type ModSlotKind,
  type SlotId,
} from "@/components/build-editor";
import type { HelminthAbility } from "@/lib/helminth-query";
import type { PlacedShard } from "@/lib/shards";
import type { Polarity } from "@arsenyx/shared/warframe/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { itemQuery } from "@/lib/item-query";
import { modsQuery } from "@/lib/mods-query";
import {
  CATEGORIES,
  getImageUrl,
  isValidCategory,
  type BrowseCategory,
  type DetailItem,
} from "@/lib/warframe";
import { getModsForItem } from "@arsenyx/shared/warframe/mods";

type CreateSearch = {
  item: string;
  category: BrowseCategory;
};

export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>): CreateSearch => {
    const item = typeof search.item === "string" ? search.item : "";
    const category =
      typeof search.category === "string" && isValidCategory(search.category)
        ? search.category
        : ("warframes" as BrowseCategory);
    return { item, category };
  },
  beforeLoad: ({ search }) => {
    if (!search.item) {
      throw redirect({ to: "/browse", search: { category: "warframes" } });
    }
  },
  loaderDeps: ({ search }) => ({
    item: search.item,
    category: search.category,
  }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(itemQuery(deps.category, deps.item)),
      context.queryClient.ensureQueryData(modsQuery),
    ]);
  },
  component: CreatePage,
});

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
  );
}

function EditorShell() {
  const { item: slug, category } = Route.useSearch();
  const { data: item } = useSuspenseQuery(itemQuery(category, slug));
  const categoryLabel =
    CATEGORIES.find((c) => c.id === category)?.label ?? category;

  const isCompanion = category === "companions";
  const normalSlotCount = 8;
  const slots = useBuildSlots(normalSlotCount);

  const [hasReactor, setHasReactor] = useState(true);
  const [shards, setShards] = useState<(PlacedShard | null)[]>(() =>
    Array.from({ length: 5 }, () => null),
  );
  const setShard = (i: number, s: PlacedShard | null) => {
    setShards((prev) => {
      const next = [...prev];
      next[i] = s;
      return next;
    });
  };

  const [helminth, setHelminth] = useState<Record<number, HelminthAbility>>({});
  const setHelminthAt = (i: number, ab: HelminthAbility | null) => {
    setHelminth((prev) => {
      if (!ab) {
        const { [i]: _removed, ...rest } = prev;
        return rest;
      }
      // Only one subsumed ability per build.
      return { [i]: ab };
    });
  };

  const auraRaw = Array.isArray(item.aura) ? item.aura[0] : item.aura;
  const auraInnate = toPolarity(auraRaw);
  const normalInnates = useMemo(
    () =>
      Array.from({ length: normalSlotCount }, (_, i) =>
        toPolarity(item.polarities?.[i]),
      ),
    [item.polarities, normalSlotCount],
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

  return (
    <>
      <EditorHeader
        item={item}
        category={category}
        slug={slug}
        categoryLabel={categoryLabel}
        totalEndoCost={totalEndoCost}
        formaCount={formaCount}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:relative lg:block">
          <div className="bg-card w-full rounded-lg border lg:absolute lg:top-0 lg:bottom-0 lg:left-0 lg:w-[260px] lg:overflow-y-auto">
            <ItemSidebar
              item={item}
              category={category}
              capacityUsed={capacity.used}
              capacityMax={capacity.max}
              capacityAuraBonus={capacity.auraBonus}
              hasReactor={hasReactor}
              onToggleReactor={() => setHasReactor((v) => !v)}
              shards={shards}
              onSetShard={setShard}
              helminth={helminth}
              onSetHelminth={setHelminthAt}
            />
          </div>

          <div
            className="bg-card min-w-0 flex-1 overflow-hidden rounded-lg border p-2 sm:p-4 lg:ml-[calc(260px+1rem)]"
            onClick={(e) => {
              if (!(e.target instanceof HTMLElement)) return;
              if (!e.target.closest("[data-build-slot]")) {
                slots.select(null);
              }
            }}
          >
            <ModGrid
              item={item}
              category={category}
              isCompanion={isCompanion}
              normalSlotCount={normalSlotCount}
              slots={slots}
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <SearchPanel
            item={item}
            usedModNames={slots.usedNames}
            onSelect={slots.place}
            selectedSlotKind={
              slots.selected === "aura" || slots.selected === "exilus"
                ? slots.selected
                : undefined
            }
          />
        </div>

        <div className="bg-card rounded-lg border p-4">
          <GuidePlaceholder />
        </div>
      </div>
    </>
  );
}

function EditorHeader({
  item,
  category,
  slug,
  categoryLabel,
  totalEndoCost,
  formaCount,
}: {
  item: DetailItem;
  category: BrowseCategory;
  slug: string;
  categoryLabel: string;
  totalEndoCost: number;
  formaCount: number;
}) {
  const [buildName, setBuildName] = useState(item.name);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };
  const commit = () => {
    const trimmed = buildName.trim();
    setBuildName(trimmed || item.name);
    setEditing(false);
  };
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
                  onChange={(e) => setBuildName(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    else if (e.key === "Escape") {
                      setBuildName(buildName);
                      setEditing(false);
                    }
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
        <div className="flex gap-2">
          <Button size="sm" disabled>
            <UploadCloud data-icon="inline-start" />
            Publish (sign in)
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <RouterLink
                to="/browse/$category/$slug"
                params={{ category, slug }}
              />
            }
          >
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

const CANONICAL_SET = new Set<Polarity>(CANONICAL_POLARITIES);

function toPolarity(v: string | undefined): Polarity | undefined {
  if (!v) return undefined;
  return CANONICAL_SET.has(v as Polarity) ? (v as Polarity) : undefined;
}

function ModGrid({
  item,
  category,
  isCompanion,
  normalSlotCount,
  slots,
}: {
  item: DetailItem;
  category: BrowseCategory;
  isCompanion: boolean;
  normalSlotCount: number;
  slots: import("@/components/build-editor").BuildSlotsState;
}) {
  const slotsPerRow = isCompanion ? 5 : 4;
  const isWarframe = category === "warframes" || category === "necramechs";
  const arcaneCount = getArcaneSlotCount(category);

  // WFCD `aura` is usually a string, but a few items (e.g. Jade) ship it as string[].
  const auraRaw = Array.isArray(item.aura) ? item.aura[0] : item.aura;
  const auraPolarity = toPolarity(auraRaw);
  const polarities = item.polarities ?? [];

  const normalRows: number[][] = [];
  for (let i = 0; i < normalSlotCount; i += slotsPerRow) {
    normalRows.push(
      Array.from(
        { length: Math.min(slotsPerRow, normalSlotCount - i) },
        (_, j) => i + j,
      ),
    );
  }

  const slotProps = (id: SlotId, innate?: Polarity) => {
    const placed = slots.placed[id];
    const forma = slots.formaPolarities[id];
    return {
      slotPolarity: innate,
      formaPolarity: forma,
      mod: placed?.mod,
      rank: placed?.rank,
      selected: slots.selected === id,
      onClick: () => slots.select(id),
      onRemove: placed ? () => slots.remove(id) : undefined,
      onPickPolarity: (p: Polarity) => slots.setForma(id, p),
      onRankChange: placed
        ? (delta: number) => slots.setRank(id, placed.rank + delta)
        : undefined,
    };
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-4">
      {(isWarframe || isCompanion) && (
        <div className="flex w-full justify-center gap-2 sm:gap-4">
          <ModSlot kind="aura" {...slotProps("aura", auraPolarity)} />
          <ModSlot kind="exilus" {...slotProps("exilus", undefined)} />
        </div>
      )}

      {normalRows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className="grid grid-cols-2 justify-center gap-x-2 gap-y-6 sm:flex sm:gap-4"
        >
          {row.map((i) => {
            const id: SlotId = `normal-${i}`;
            return (
              <ModSlot key={i} {...slotProps(id, toPolarity(polarities[i]))} />
            );
          })}
        </div>
      ))}

      {arcaneCount > 0 && (
        <div className="flex w-full items-start justify-center gap-3 sm:gap-6">
          {Array.from({ length: arcaneCount }).map((_, i) => (
            <ArcaneSlot key={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchPanel({
  item,
  usedModNames,
  onSelect,
  selectedSlotKind,
}: {
  item: DetailItem;
  usedModNames: Set<string>;
  onSelect: (mod: import("@arsenyx/shared/warframe/types").Mod) => void;
  selectedSlotKind?: ModSlotKind;
}) {
  const { data: allMods } = useSuspenseQuery(modsQuery);
  const compatible = useMemo(
    () =>
      getModsForItem(
        {
          type: item.type,
          category: item.category,
          name: item.name,
        },
        allMods,
      ),
    [allMods, item.type, item.category, item.name],
  );

  return (
    <ModSearchGrid
      mods={compatible}
      usedModNames={usedModNames}
      onSelect={onSelect}
      selectedSlotKind={selectedSlotKind}
    />
  );
}

function GuidePlaceholder() {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Build Guide</h2>
      <p className="text-muted-foreground text-sm">
        Rich-text guide editor (summary + description + partner builds) lands
        with save support in Slice 6d.
      </p>
    </div>
  );
}

function pct(v: number | undefined): string | undefined {
  if (v === undefined) return undefined;
  return `${(v * 100).toFixed(1)}%`;
}
