# Build Discovery & Sharing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add build forking ("Use as Template"), full-text search with filters on `/builds/`, a Cmd+K global search palette, and a share button with Web Share API.

**Architecture:** Four independent features sharing a PostgreSQL full-text search backend. Features 1 (fork) and 4 (share) are purely UI. Feature 2 (build search) adds a `tsvector` column + GIN index and a `hasGuide` denormalized flag. Feature 3 (Cmd+K) reuses Feature 2's search plus the existing `searchItemsFromDb`.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Prisma + raw SQL for tsvector, shadcn/ui (Command, Dialog, DropdownMenu, sonner), Tailwind v4, Bun.

**Spec:** `docs/superpowers/specs/2026-03-21-build-discovery-and-sharing-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `prisma/migrations/XXXXXX_build_search/migration.sql` | Raw SQL: `searchVector` tsvector column, GIN index, trigger, `hasGuide` column |
| ~~`src/lib/db/search.ts`~~ | Search logic lives in `src/lib/db/builds.ts` as `searchBuildsWithFilters()` (no separate file) |
| `src/components/search-command.tsx` | Cmd+K palette — client component with `CommandDialog` |
| `src/components/build/share-button.tsx` | Share dropdown — client component with `DropdownMenu` |
| `src/components/build/template-button.tsx` | "Use as Template" link button — server component |
| `src/app/api/search/route.ts` | GET `/api/search?q=` — global search endpoint |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `searchVector Unsupported("tsvector")?` and `hasGuide Boolean @default(false)` to Build |
| `src/lib/db/index.ts` | Re-export new search functions |
| `src/lib/db/builds.ts` | Update `createBuild`/`updateBuild` to set `hasGuide`, update `getPublicBuilds` to accept search/filter params |
| `src/lib/rate-limit.ts` | Add `searchLimiter` pre-configured instance |
| `src/app/builds/page.tsx` | Add search bar, filters UI, wire up new query params |
| `src/app/builds/[slug]/page.tsx` | Add TemplateButton and ShareButton to build banner |
| `src/app/create/page.tsx` | Handle `?fork=` search param |
| `src/components/header.tsx` | Replace search icon button with `SearchCommand` client component |

---

## Task 1: Install Missing shadcn Components

**Files:**
- Modify: `src/components/ui/dropdown-menu.tsx` (auto-generated)
- Verify: `src/app/layout.tsx` (sonner already present)

- [ ] **Step 1: Install dropdown-menu**

```bash
bunx --bun shadcn@latest add dropdown-menu -y
```

- [ ] **Step 2: Verify sonner is already set up**

Sonner `<Toaster />` is already in `src/app/layout.tsx:46`. No install needed. Verify:

```bash
grep -n "Toaster" src/app/layout.tsx
```

Expected: line showing `import { Toaster } from "sonner"` and `<Toaster .../>`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "chore: add shadcn dropdown-menu component"
```

---

## Task 2: Schema Migration — searchVector + hasGuide

**Files:**
- Modify: `prisma/schema.prisma`
- Create: raw SQL migration

- [ ] **Step 1: Add fields to Prisma schema**

In `prisma/schema.prisma`, add to the `Build` model (after the `hasShards` field):

```prisma
  hasGuide  Boolean @default(false)

  // Full-text search vector (managed by PostgreSQL trigger, not Prisma)
  searchVector Unsupported("tsvector")?
```

Add index (inside the Build model's index block):

```prisma
  @@index([hasGuide])
```

- [ ] **Step 2: Create migration with --create-only**

```bash
bunx prisma migrate dev --name build_search --create-only
```

- [ ] **Step 3: Edit the generated migration SQL**

Append to the generated migration file (after Prisma's auto-generated statements):

```sql
-- GIN index for full-text search
CREATE INDEX "builds_search_vector_idx" ON "builds" USING GIN ("searchVector");

-- Trigger function to auto-update searchVector
CREATE OR REPLACE FUNCTION builds_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := (
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce((SELECT name FROM items WHERE id = NEW."itemId"), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER builds_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, "itemId"
  ON "builds"
  FOR EACH ROW
  EXECUTE FUNCTION builds_search_vector_update();

-- Backfill searchVector for existing builds
UPDATE "builds" SET name = name WHERE true;

-- Backfill hasGuide for existing builds
UPDATE "builds" b SET "hasGuide" = true
WHERE EXISTS (SELECT 1 FROM "build_guides" bg WHERE bg."buildId" = b.id);
```

- [ ] **Step 4: Run the migration**

```bash
bunx prisma migrate dev
```

Expected: Migration applied successfully.

- [ ] **Step 5: Regenerate Prisma client**

```bash
bunx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add searchVector tsvector column and hasGuide flag to builds"
```

---

## Task 3: Update Build DB Layer — hasGuide Tracking

**Files:**
- Modify: `src/lib/db/builds.ts:264-270` (createBuild guide section)
- Modify: `src/lib/db/builds.ts:524-543` (updateBuild guide section)

- [ ] **Step 1: Update createBuild to set hasGuide**

In `src/lib/db/builds.ts`, in the `createBuild` function, add `hasGuide` to the `data` object inside `prisma.build.create`:

```typescript
const build = await prisma.build.create({
    data: {
      slug,
      userId,
      itemId: item.id,
      name: input.name,
      description: input.description,
      visibility: input.visibility ?? "PUBLIC",
      buildData: sanitizeBuildDataForDb(input.buildData),
      hasShards: detectHasShards(input.buildData),
      hasGuide: !!(input.guideSummary || input.guideDescription),
      buildGuide: guideCreate,
      partnerBuilds: partnerBuildsConnect,
    },
    include: buildInclude,
  });
```

- [ ] **Step 2: Update updateBuild to maintain hasGuide**

In the `updateBuild` function, after the guide update block (`if (hasGuideUpdate)`), add:

```typescript
  if (hasGuideUpdate) {
    // ... existing guide upsert code ...

    // Update denormalized hasGuide flag.
    // Only set to false when BOTH fields are explicitly null (clearing the guide).
    // If only one field is provided, the other may still have content in DB.
    if (input.guideSummary === null && input.guideDescription === null) {
      updateData.hasGuide = false;
    } else if (input.guideSummary || input.guideDescription) {
      updateData.hasGuide = true;
    }
    // If one field is undefined (not being updated), don't change hasGuide
  }
```

- [ ] **Step 3: Update GetBuildsOptions type**

Add new filter fields to `GetBuildsOptions`:

```typescript
export interface GetBuildsOptions {
  page?: number;
  limit?: number;
  sortBy?: "newest" | "votes" | "views" | "updated" | "popular";
  category?: string;
  query?: string;
  author?: string;
  hasGuide?: boolean;
  hasShards?: boolean;
}
```

- [ ] **Step 4: Update getPublicBuilds to support new filters**

```typescript
export async function getPublicBuilds(
  options: GetBuildsOptions = {}
): Promise<{ builds: BuildWithUser[]; total: number }> {
  const { page = 1, limit = 20, sortBy = "newest", category, query, author, hasGuide, hasShards } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.BuildWhereInput = {
    visibility: "PUBLIC",
    ...(category && {
      item: {
        browseCategory: category,
      },
    }),
    ...(author && {
      user: {
        username: { equals: author, mode: "insensitive" },
      },
    }),
    ...(hasGuide === true && { hasGuide: true }),
    ...(hasShards === true && { hasShards: true }),
  };

  // If there's a text query, use raw SQL for tsvector search
  if (query && query.trim().length >= 2) {
    return searchBuildsWithFilters(query.trim(), where, sortBy, skip, limit);
  }

  const [builds, total] = await Promise.all([
    prisma.build.findMany({
      where,
      include: buildInclude,
      orderBy: getOrderBy(sortBy),
      skip,
      take: limit,
    }),
    prisma.build.count({ where }),
  ]);

  return {
    builds: builds.map((b) => mapBuildResult(b)),
    total,
  };
}
```

- [ ] **Step 5: Add searchBuildsWithFilters helper**

Add at the bottom of `src/lib/db/builds.ts` (before the HELPERS section):

```typescript
// =============================================================================
// FULL-TEXT SEARCH
// =============================================================================

/**
 * Search builds using PostgreSQL full-text search with additional Prisma filters.
 * Uses $queryRaw for the tsvector query, then fetches full build data via Prisma.
 */
async function searchBuildsWithFilters(
  query: string,
  where: Prisma.BuildWhereInput,
  sortBy: string,
  skip: number,
  limit: number
): Promise<{ builds: BuildWithUser[]; total: number }> {
  // First, get matching build IDs via raw SQL full-text search
  const searchResults = await prisma.$queryRaw<{ id: string }[]>`
    SELECT b.id
    FROM builds b
    WHERE b."searchVector" @@ plainto_tsquery('english', ${query})
      AND b.visibility = 'PUBLIC'
    ORDER BY ts_rank(b."searchVector", plainto_tsquery('english', ${query})) DESC
    LIMIT 200
  `;

  const matchingIds = searchResults.map((r) => r.id);

  if (matchingIds.length === 0) {
    return { builds: [], total: 0 };
  }

  // Apply additional Prisma filters on the matched IDs
  const fullWhere: Prisma.BuildWhereInput = {
    ...where,
    id: { in: matchingIds },
  };

  const [builds, total] = await Promise.all([
    prisma.build.findMany({
      where: fullWhere,
      include: buildInclude,
      orderBy: getOrderBy(sortBy as "newest" | "votes" | "views" | "updated" | "popular"),
      skip,
      take: limit,
    }),
    prisma.build.count({ where: fullWhere }),
  ]);

  return {
    builds: builds.map((b) => mapBuildResult(b)),
    total,
  };
}
```

- [ ] **Step 6: Update db/index.ts exports**

Add to the re-exports in `src/lib/db/index.ts`:

```typescript
export type {
  CreateBuildInput,
  UpdateBuildInput,
  BuildWithUser,
  GetBuildsOptions,
} from "./builds";
```

(`GetBuildsOptions` is already exported — verify it's there.)

- [ ] **Step 7: Verify the build compiles**

```bash
bun build --no-bundle src/lib/db/builds.ts 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/builds.ts src/lib/db/index.ts
git commit -m "feat: add full-text search and filter support to build queries"
```

---

## Task 4: Build Forking ("Use as Template")

**Files:**
- Create: `src/components/build/template-button.tsx`
- Modify: `src/app/create/page.tsx`
- Modify: `src/app/builds/[slug]/page.tsx`

- [ ] **Step 1: Create TemplateButton component**

Create `src/components/build/template-button.tsx`:

```tsx
import Link from "next/link";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/warframe/slugs";

interface TemplateButtonProps {
  buildSlug: string;
  itemName: string;
  category: string;
}

export function TemplateButton({ buildSlug, itemName, category }: TemplateButtonProps) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        href={`/create?category=${category}&item=${slugify(itemName)}&fork=${buildSlug}`}
      >
        <Copy data-icon="inline-start" />
        Use as Template
      </Link>
    </Button>
  );
}
```

- [ ] **Step 2: Add TemplateButton to build view page**

In `src/app/builds/[slug]/page.tsx`, import and add the button in the banner area. Add the import:

```typescript
import { TemplateButton } from "@/components/build/template-button";
```

Add the button in the banner, inside the `<div className="flex items-center gap-2">` that contains `BuildSocialActions`:

```tsx
<div className="flex items-center gap-2">
  <BuildSocialActions
    buildId={build.id}
    voteCount={build.voteCount}
    favoriteCount={build.favoriteCount}
    viewCount={build.viewCount}
  />
  <TemplateButton
    buildSlug={build.slug}
    itemName={build.item.name}
    category={category}
  />
  <span className="text-sm text-muted-foreground">
    Updated {new Date(build.updatedAt).toLocaleDateString()}
  </span>
</div>
```

- [ ] **Step 3: Handle fork param in create page**

In `src/app/create/page.tsx`, update the `CreatePageProps` interface to include `fork`:

```typescript
interface CreatePageProps {
  searchParams: Promise<{
    item?: string;
    category?: string;
    build?: string;
    fork?: string;
  }>;
}
```

Add a new block after the `params.build` check (before the `params.item && params.category` check). This goes at roughly line 112:

```typescript
  // Check for fork (Use as Template) — copies only mod slots from source build
  if (params.fork && params.item && params.category) {
    if (!isValidCategory(params.category)) {
      notFound();
    }

    const category = params.category as BrowseCategory;
    const item = getItemBySlug(category, params.item);

    if (!item) {
      notFound();
    }

    // Fetch the source build to copy mods from
    const { getBuildBySlug } = await import("@/lib/db/index");
    const sourceBuild = await getBuildBySlug(params.fork);

    const fullItem = getFullItem(category, item.uniqueName);
    const categoryConfig = getCategoryConfig(category);
    const compatibleMods = fullItem ? getModsForItem(fullItem) : [];
    let compatibleArcanes: Arcane[] = [];
    if (["warframes", "necramechs"].includes(category)) {
      compatibleArcanes = getArcanesForSlot("warframe");
    } else if (["primary", "secondary", "melee"].includes(category)) {
      compatibleArcanes = getArcanesForSlot(
        category as "primary" | "secondary" | "melee"
      );
    }

    // Extract only mod configuration from source build
    const importedBuild = sourceBuild
      ? {
          itemUniqueName: item.uniqueName,
          itemName: item.name,
          itemCategory: category,
          itemImageName: item.imageName,
          normalSlots: sourceBuild.buildData.normalSlots,
          auraSlot: sourceBuild.buildData.auraSlot,
          exilusSlot: sourceBuild.buildData.exilusSlot,
          hasReactor: sourceBuild.buildData.hasReactor,
          formaCount: sourceBuild.buildData.formaCount,
          // Everything else uses defaults from BuildContainer
          arcaneSlots: [],
          shardSlots: [],
          baseCapacity: sourceBuild.buildData.hasReactor ? 60 : 30,
          currentCapacity: 0, // Will be recalculated
        }
      : undefined;

    return (
      <div className="relative min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Suspense fallback={<BuildEditorSkeleton />}>
            <BuildContainer
              item={fullItem ?? item}
              category={category}
              categoryLabel={categoryConfig?.label ?? "Item"}
              compatibleMods={compatibleMods}
              compatibleArcanes={compatibleArcanes}
              importedBuild={importedBuild}
            />
          </Suspense>
        </main>
        <Footer />
      </div>
    );
  }
```

- [ ] **Step 4: Verify the fork flow compiles**

```bash
bun dev &
sleep 3
kill %1
```

Check for no build errors in the output.

- [ ] **Step 5: Commit**

```bash
git add src/components/build/template-button.tsx src/app/create/page.tsx src/app/builds/\[slug\]/page.tsx
git commit -m "feat: add Use as Template button for build forking"
```

---

## Task 5: Build Search & Filtering UI

**Files:**
- Modify: `src/app/builds/page.tsx`

- [ ] **Step 1: Update BuildsPageProps search params**

```typescript
interface BuildsPageProps {
  searchParams: Promise<{
    category?: string;
    sort?: "newest" | "popular" | "updated";
    page?: string;
    q?: string;
    author?: string;
    hasGuide?: string;
    hasShards?: string;
  }>;
}
```

- [ ] **Step 2: Create URL helper for preserving params**

Add this helper function inside the file (after the `getRelativeTime` function):

```typescript
/** Build a URLSearchParams string preserving all active filters */
function buildFilterUrl(
  overrides: Record<string, string | undefined>,
  current: {
    category?: string;
    sort: string;
    q?: string;
    author?: string;
    hasGuide?: string;
    hasShards?: string;
  }
) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.category) params.set("category", merged.category);
  if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
  if (merged.q) params.set("q", merged.q);
  if (merged.author) params.set("author", merged.author);
  if (merged.hasGuide) params.set("hasGuide", merged.hasGuide);
  if (merged.hasShards) params.set("hasShards", merged.hasShards);
  // Never preserve page when changing filters
  if (overrides.page) params.set("page", overrides.page);
  const str = params.toString();
  return `/builds${str ? `?${str}` : ""}`;
}
```

- [ ] **Step 3: Update the page component to read new params and query**

Replace the data fetching section at the top of `BuildsPage`:

```typescript
export default async function BuildsPage({ searchParams }: BuildsPageProps) {
  const params = await searchParams;
  const category = params.category || undefined;
  const sortBy = (params.sort as "newest" | "votes" | "views" | "updated") || "newest";
  const page = parseInt(params.page || "1", 10);
  const q = params.q || undefined;
  const author = params.author || undefined;
  const hasGuide = params.hasGuide === "true" ? true : undefined;
  const hasShards = params.hasShards === "true" ? true : undefined;
  const limit = 24;

  const filterState = {
    category,
    sort: sortBy,
    q,
    author,
    hasGuide: params.hasGuide,
    hasShards: params.hasShards,
  };

  const { builds, total } = await getPublicBuilds({
    category,
    sortBy,
    page,
    limit,
    query: q,
    author,
    hasGuide,
    hasShards,
  });

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = !!(q || author || hasGuide || hasShards);
```

- [ ] **Step 4: Add search bar and filters UI**

Add after the `{/* Header */}` section and before `{/* Filters */}`:

Add import at top: `import { Input } from "@/components/ui/input";`

```tsx
{/* Search Bar */}
<form action="/builds" method="GET" className="flex gap-2">
  <div className="relative flex-1">
    <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    <Input
      type="search"
      name="q"
      defaultValue={q}
      placeholder="Search builds..."
      className="pl-10"
    />
  </div>
  {/* Preserve current filters in hidden inputs */}
  {category && <input type="hidden" name="category" value={category} />}
  {sortBy !== "newest" && <input type="hidden" name="sort" value={sortBy} />}
  {author && <input type="hidden" name="author" value={author} />}
  {hasGuide && <input type="hidden" name="hasGuide" value="true" />}
  {hasShards && <input type="hidden" name="hasShards" value="true" />}
  <Button type="submit">Search</Button>
</form>
```

Add import for `Icons` at top: `import { Icons } from "@/components/icons";`

- [ ] **Step 5: Add filter toggles below the tabs**

After the existing sort options `</div>`, add:

```tsx
{/* Active Filters */}
<div className="flex flex-wrap items-center gap-2">
  {author && (
    <Badge variant="secondary" className="gap-1">
      Author: {author}
      <Link href={buildFilterUrl({ author: undefined }, filterState)}>
        <span className="sr-only">Remove author filter</span>
        &times;
      </Link>
    </Badge>
  )}
  {hasGuide && (
    <Badge variant="secondary" className="gap-1">
      Has Guide
      <Link href={buildFilterUrl({ hasGuide: undefined }, filterState)}>
        <span className="sr-only">Remove guide filter</span>
        &times;
      </Link>
    </Badge>
  )}
  {hasShards && (
    <Badge variant="secondary" className="gap-1">
      Has Shards
      <Link href={buildFilterUrl({ hasShards: undefined }, filterState)}>
        <span className="sr-only">Remove shards filter</span>
        &times;
      </Link>
    </Badge>
  )}
  {!hasGuide && (
    <Link href={buildFilterUrl({ hasGuide: "true" }, filterState)}>
      <Button variant="outline" size="sm">Has Guide</Button>
    </Link>
  )}
  {!hasShards && (
    <Link href={buildFilterUrl({ hasShards: "true" }, filterState)}>
      <Button variant="outline" size="sm">Has Shards</Button>
    </Link>
  )}
  {hasActiveFilters && (
    <Link href="/builds">
      <Button variant="ghost" size="sm">Clear All</Button>
    </Link>
  )}
</div>
```

- [ ] **Step 6: Update all existing Link hrefs to use buildFilterUrl**

Replace all hardcoded `URLSearchParams` in category tabs, sort tabs, and pagination with `buildFilterUrl`:

Category tabs:
```tsx
<Link href={buildFilterUrl({ category: opt.value || undefined }, filterState)}>
```

Sort tabs:
```tsx
<Link href={buildFilterUrl({ sort: opt.value }, filterState)}>
```

Pagination Previous/Next:
```tsx
<Link href={buildFilterUrl({ page: String(page - 1) }, filterState)}>
```
```tsx
<Link href={buildFilterUrl({ page: String(page + 1) }, filterState)}>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/builds/page.tsx
git commit -m "feat: add search bar and filter UI to builds page"
```

---

## Task 6: Search API Route + Rate Limiting

**Files:**
- Create: `src/app/api/search/route.ts`
- Modify: `src/lib/rate-limit.ts`

- [ ] **Step 1: Add search rate limiter**

In `src/lib/rate-limit.ts`, add:

```typescript
/**
 * Search rate limiter: 30 searches per minute per IP
 */
export const searchLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});
```

- [ ] **Step 2: Create the search API route**

Create `src/app/api/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { searchItemsFromDb, prisma } from "@/lib/db/index";
import { searchLimiter, RateLimitError } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await searchLimiter.check(30, ip);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2 || q.length > 100) {
    return NextResponse.json({ items: [], builds: [] });
  }

  const [items, buildResults] = await Promise.all([
    // Items: use existing ILIKE search
    searchItemsFromDb(q, undefined, 5),
    // Builds: use tsvector search
    prisma.$queryRaw<
      {
        slug: string;
        name: string;
        itemName: string;
        author: string;
        voteCount: number;
      }[]
    >`
      SELECT
        b.slug,
        b.name,
        i.name AS "itemName",
        COALESCE(u.username, u.name, 'Anonymous') AS author,
        b."voteCount"
      FROM builds b
      JOIN items i ON i.id = b."itemId"
      JOIN users u ON u.id = b."userId"
      WHERE b."searchVector" @@ plainto_tsquery('english', ${q})
        AND b.visibility = 'PUBLIC'
      ORDER BY ts_rank(b."searchVector", plainto_tsquery('english', ${q})) DESC
      LIMIT 5
    `,
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      uniqueName: item.uniqueName,
      name: item.name,
      imageName: item.imageName,
      browseCategory: item.category, // BrowseItem uses `category`, not `browseCategory`
    })),
    builds: buildResults,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/route.ts src/lib/rate-limit.ts
git commit -m "feat: add global search API route with rate limiting"
```

---

## Task 7: Cmd+K Search Palette

**Files:**
- Create: `src/components/search-command.tsx`
- Modify: `src/components/header.tsx`

- [ ] **Step 1: Create SearchCommand component**

Create `src/components/search-command.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, FileText, ThumbsUp } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { getImageUrl } from "@/lib/warframe/images";
import { slugify } from "@/lib/warframe/slugs";

interface SearchItem {
  uniqueName: string;
  name: string;
  imageName: string | null;
  browseCategory: string;
}

interface SearchBuild {
  slug: string;
  name: string;
  itemName: string;
  author: string;
  voteCount: number;
}

interface SearchResults {
  items: SearchItem[];
  builds: SearchBuild[];
}

export function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ items: [], builds: [] });
  const [loading, setLoading] = useState(false);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search with AbortController to prevent race conditions
  useEffect(() => {
    if (query.length < 2) {
      setResults({ items: [], builds: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          // Silently fail for non-abort errors
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const handleSelect = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery("");
      router.push(path);
    },
    [router]
  );

  const hasResults = results.items.length > 0 || results.builds.length > 0;
  const hasQuery = query.length >= 2;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground size-9 cursor-pointer"
      >
        <Search className="size-[1.2rem]" />
        <span className="sr-only">Search</span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search items and builds..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Spinner />
            </div>
          )}
          {!loading && hasQuery && !hasResults && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {results.items.length > 0 && (
            <CommandGroup heading="Items">
              {results.items.map((item) => (
                <CommandItem
                  key={item.uniqueName}
                  value={`item-${item.name}`}
                  onSelect={() =>
                    handleSelect(
                      `/browse/${item.browseCategory}/${slugify(item.name)}`
                    )
                  }
                >
                  <Image
                    src={getImageUrl(item.imageName ?? undefined)}
                    alt={item.name}
                    width={24}
                    height={24}
                    className="rounded"
                    unoptimized
                  />
                  <span>{item.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">
                    {item.browseCategory}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {results.builds.length > 0 && (
            <CommandGroup heading="Builds">
              {results.builds.map((build) => (
                <CommandItem
                  key={build.slug}
                  value={`build-${build.name}`}
                  onSelect={() => handleSelect(`/builds/${build.slug}`)}
                >
                  <FileText className="text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{build.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {build.itemName} by {build.author}
                    </span>
                  </div>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="size-3" />
                    {build.voteCount}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
```

- [ ] **Step 2: Update header to use SearchCommand**

In `src/components/header.tsx`, replace the search button with the new component.

Add import:
```typescript
import { SearchCommand } from "@/components/search-command";
```

Replace:
```tsx
<Button variant="ghost" size="icon" className="hidden sm:flex">
  <Icons.search />
  <span className="sr-only">Search</span>
</Button>
```

With:
```tsx
<div className="hidden sm:flex">
  <SearchCommand />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/search-command.tsx src/components/header.tsx
git commit -m "feat: add Cmd+K global search palette"
```

---

## Task 8: Share Button

**Files:**
- Create: `src/components/build/share-button.tsx`
- Modify: `src/app/builds/[slug]/page.tsx`

- [ ] **Step 1: Create ShareButton component**

Create `src/components/build/share-button.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShareButtonProps {
  buildName: string;
  itemName: string;
}

export function ShareButton({ buildName, itemName }: ShareButtonProps) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `${buildName} - ${itemName} Build | ARSENYX`,
        url: window.location.href,
      });
    } catch (e) {
      // User cancelled share — not an error
      if (e instanceof Error && e.name !== "AbortError") {
        toast.error("Failed to share");
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 data-icon="inline-start" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={copyLink}>
            <Link2 />
            Copy Link
          </DropdownMenuItem>
          {canShare && (
            <DropdownMenuItem onSelect={nativeShare}>
              <Share2 />
              Share...
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Add ShareButton to build view page**

In `src/app/builds/[slug]/page.tsx`, add the import:

```typescript
import { ShareButton } from "@/components/build/share-button";
```

Add `ShareButton` in the banner area, after the `TemplateButton` (added in Task 4):

```tsx
<ShareButton
  buildName={build.name}
  itemName={build.item.name}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/build/share-button.tsx src/app/builds/\[slug\]/page.tsx
git commit -m "feat: add share button with copy link and Web Share API"
```

---

## Task 9: Final Integration & Smoke Test

- [ ] **Step 1: Run the dev server**

```bash
bun dev
```

- [ ] **Step 2: Smoke test each feature**

1. **Fork:** Navigate to any build → click "Use as Template" → verify editor loads with mods pre-filled
2. **Build Search:** Go to `/builds` → type in search bar → verify results filter. Toggle "Has Guide" and "Has Shards" filters.
3. **Cmd+K:** Press `Ctrl+K` → type a query → verify items and builds appear → select one → verify navigation
4. **Share:** On a build page → click Share → "Copy Link" → verify toast. On mobile or supported browser, verify "Share..." option appears.

- [ ] **Step 3: Run lint**

```bash
bun lint
```

Fix any lint errors.

- [ ] **Step 4: Run existing tests**

```bash
bun test
```

Verify no regressions.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint and integration issues from build discovery features"
```
