import {
  createFileRoute,
  redirect,
  Link as RouterLink,
} from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Diamond, Gem, Pencil, UploadCloud, X } from "lucide-react";
import { Suspense, useMemo } from "react";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ModSearchGrid, ModSlot } from "@/components/build-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { itemQuery } from "@/lib/item-query";
import { modsQuery } from "@/lib/mods-query";
import { cn } from "@/lib/utils";
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

  return (
    <>
      <EditorHeader item={item} categoryLabel={categoryLabel} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:relative lg:block">
          <div className="bg-card w-full rounded-lg border lg:absolute lg:top-0 lg:bottom-0 lg:left-0 lg:w-[260px] lg:overflow-y-auto">
            <ItemSidebar item={item} category={category} />
          </div>

          <div className="bg-card min-w-0 flex-1 overflow-hidden rounded-lg border p-2 sm:p-4 lg:ml-[calc(260px+1rem)]">
            <ModGrid category={category} />
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <SearchPanel item={item} />
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
  categoryLabel,
}: {
  item: DetailItem;
  categoryLabel: string;
}) {
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
              <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:text-2xl">
                {item.name}
              </h1>
              <Button variant="ghost" size="icon-sm" disabled title="Rename (sign in)">
                <Pencil />
              </Button>
            </div>
            <span className="text-muted-foreground text-sm">
              {item.name} · {categoryLabel}
            </span>
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
              >
                <Diamond className="size-3 fill-current" />0
              </Badge>
              <Badge
                variant="secondary"
                className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
              >
                <Gem className="size-3" />0
              </Badge>
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
                params={{ category: item.category, slug: item.slug }}
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

function ItemSidebar({
  item,
  category,
}: {
  item: DetailItem;
  category: BrowseCategory;
}) {
  const isWarframe = category === "warframes" || category === "necramechs";
  const isWeapon =
    category === "primary" ||
    category === "secondary" ||
    category === "melee" ||
    category === "companion-weapons" ||
    category === "archwing" ||
    category === "exalted-weapons";
  const abilities = item.abilities ?? [];

  return (
    <div className="flex h-full flex-col">
      {isWarframe && abilities.length > 0 && (
        <div className="flex justify-around p-3">
          {abilities.slice(0, 4).map((ability, i) => (
            <div
              key={ability.uniqueName}
              title={`${ability.name} — ${ability.description}`}
              className="bg-muted border-border relative size-10 overflow-hidden rounded border"
            >
              <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {isWarframe && abilities.length > 0 && <Separator />}

      <div className="flex flex-col gap-3 p-4">
        <CapacityBar used={0} max={60} />

        {isWarframe && (
          <StatsBlock
            rows={[
              ["Health", item.health],
              ["Shield", item.shield],
              ["Armor", item.armor],
              ["Energy", item.power],
              ["Sprint", item.sprintSpeed],
            ]}
          />
        )}
        {isWeapon && (
          <StatsBlock
            rows={[
              ["Damage", item.totalDamage],
              ["Crit Chance", pct(item.criticalChance)],
              [
                "Crit Multi",
                item.criticalMultiplier
                  ? `${item.criticalMultiplier}x`
                  : undefined,
              ],
              ["Status", pct(item.procChance)],
              ["Fire Rate", item.fireRate],
              ["Magazine", item.magazineSize],
              [
                "Reload",
                item.reloadTime !== undefined
                  ? `${parseFloat(item.reloadTime.toFixed(2))}s`
                  : undefined,
              ],
            ]}
          />
        )}
      </div>
    </div>
  );
}

function CapacityBar({ used, max }: { used: number; max: number }) {
  const pctVal = Math.min(100, (used / max) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Capacity</span>
        <span className="font-semibold tabular-nums">
          {used} / {max}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all"
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  );
}

function StatsBlock({
  rows,
}: {
  rows: [string, string | number | undefined][];
}) {
  const shown = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {shown.map(([label, v]) => (
        <div
          key={label}
          className="col-span-2 flex items-baseline justify-between"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular-nums">
            {typeof v === "number" && !Number.isInteger(v)
              ? parseFloat(v.toFixed(2))
              : v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ModGrid({ category }: { category: BrowseCategory }) {
  const isCompanion = category === "companions";
  const slotsPerRow = isCompanion ? 5 : 4;
  const isWarframe = category === "warframes" || category === "necramechs";

  return (
    <div className="flex flex-col gap-4">
      {(isWarframe || isCompanion) && (
        <>
          <div className="flex flex-wrap gap-3">
            <ModSlot kind="aura" />
            <ModSlot kind="exilus" />
          </div>
          <Separator />
        </>
      )}

      <div
        className={cn(
          "grid gap-3",
          slotsPerRow === 4
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-5",
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <ModSlot key={i} />
        ))}
      </div>
    </div>
  );
}

function SearchPanel({ item }: { item: DetailItem }) {
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

  return <ModSearchGrid mods={compatible} />;
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
