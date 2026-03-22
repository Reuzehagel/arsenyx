# Efficiency Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified inefficiencies across database indexes, image handling, page caching, data lookups, dead code, redundant queries, and Satori image caching.

**Architecture:** Changes are mostly surgical — add missing indexes, add `unoptimized` props, add page caching config, optimize lookups with Maps, remove dead code, consolidate redundant queries, and add image fetch caching for Satori.

**Tech Stack:** Next.js 16, Prisma, PostgreSQL, React 19, sharp/satori

---

### Task 1: Add missing database indexes

Add indexes to `BuildVote.buildId`, `BuildFavorite.buildId`, `Build.forkedFromId`, `BuildLink.fromBuildId`, `BuildLink.toBuildId`, `GuideVote.guideId`, `GuideFavorite.guideId`, and `Guide.createdAt`.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add indexes to social feature tables**

Add the following `@@index` directives:

```prisma
// In BuildVote model (after @@unique):
@@index([buildId])

// In BuildFavorite model (after @@unique):
@@index([buildId])

// In Build model (add to existing indexes):
@@index([forkedFromId])

// In BuildLink model (after @@unique):
@@index([fromBuildId])
@@index([toBuildId])

// In GuideVote model (after @@unique):
@@index([guideId])

// In GuideFavorite model (after @@unique):
@@index([guideId])

// In Guide model (add to existing indexes):
@@index([createdAt])
```

- [ ] **Step 2: Add cascade delete to GeneratedImage**

In the `GeneratedImage` model, add a relation to Build with cascade delete:

```prisma
model GeneratedImage {
  id String @id @default(cuid())

  buildId  String
  build    Build  @relation(fields: [buildId], references: [id], onDelete: Cascade)
  template String
  options  Json?

  imageUrl String
  width    Int
  height   Int

  createdAt DateTime @default(now())
  expiresAt DateTime

  @@unique([buildId, template, options])
  @@map("generated_images")
}
```

Also add `generatedImages GeneratedImage[]` to the Build model's relations.

- [ ] **Step 3: Push schema changes**

Run: `bun run db:push`
Expected: Schema changes applied successfully. If there are conflicts (e.g. orphaned GeneratedImage rows), just reset the database with `bun run db:push --force-reset` and re-sync with `bun run db:sync`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "perf: add missing database indexes and GeneratedImage cascade delete"
```

---

### Task 2: Add `unoptimized` to all external CDN images

Every `<Image>` loading from external CDNs (warframestat, wiki, GitHub avatars) must have `unoptimized` to skip needless server-side optimization.

**Files:**
- Modify: `src/components/build/build-card-link.tsx:39-45`
- Modify: `src/app/builds/page.tsx:86-92`
- Modify: `src/components/build-editor/build-editor-header.tsx:63-69`
- Modify: `src/components/build-editor/helminth-ability-dialog.tsx:98-103`
- Modify: `src/components/build-editor/item-sidebar.tsx:164-169`
- Modify: `src/components/auth/user-menu.tsx:31-37`
- Modify: `src/app/profile/[username]/page.tsx:63-69`

- [ ] **Step 1: Add `unoptimized` to build-card-link.tsx**

In `src/components/build/build-card-link.tsx`, add `unoptimized` to the Image component (around line 39):

```tsx
<Image
  src={getImageUrl(itemImageName ?? undefined)}
  alt={itemName}
  fill
  sizes="(max-width: 768px) 100vw, 300px"
  className="object-cover"
  unoptimized
/>
```

- [ ] **Step 2: Add `unoptimized` to builds/page.tsx**

In `src/app/builds/page.tsx`, add `unoptimized` to the Image in the `BuildCard` component (around line 86):

```tsx
<Image
  src={getImageUrl(build.item.imageName ?? undefined)}
  alt={build.item.name}
  fill
  sizes="(max-width: 768px) 100vw, 300px"
  className="object-cover"
  unoptimized
/>
```

- [ ] **Step 3: Add `unoptimized` to build-editor-header.tsx**

In `src/components/build-editor/build-editor-header.tsx`, add `unoptimized` to the Image (around line 63).

- [ ] **Step 4: Add `unoptimized` to helminth-ability-dialog.tsx**

In `src/components/build-editor/helminth-ability-dialog.tsx`, add `unoptimized` to the Image (around line 98).

- [ ] **Step 5: Add `unoptimized` to item-sidebar.tsx**

In `src/components/build-editor/item-sidebar.tsx`, add `unoptimized` to the Image (around line 164).

- [ ] **Step 6: Add `unoptimized` to user-menu.tsx**

In `src/components/auth/user-menu.tsx`, add `unoptimized` to the Image (around line 31).

- [ ] **Step 7: Add `unoptimized` to profile page**

In `src/app/profile/[username]/page.tsx`, add `unoptimized` to the avatar Image (around line 63).

- [ ] **Step 8: Commit**

```bash
git add src/components/build/build-card-link.tsx src/app/builds/page.tsx src/components/build-editor/build-editor-header.tsx src/components/build-editor/helminth-ability-dialog.tsx src/components/build-editor/item-sidebar.tsx src/components/auth/user-menu.tsx src/app/profile/\[username\]/page.tsx
git commit -m "perf: add unoptimized to all external CDN images"
```

---

### Task 3: Replace `date-fns` with native `Intl` in build-guide-section

The only usage of `date-fns` in client code is `format(lastUpdated, "P")` in `build-guide-section.tsx`. Replace with native `Intl.DateTimeFormat`.

**Files:**
- Modify: `src/components/build/build-guide-section.tsx:5,172`

- [ ] **Step 1: Replace date-fns import and usage**

Remove the `date-fns` import and replace the `format()` call:

```tsx
// Remove this line:
// import { format } from "date-fns";

// Replace the usage (around line 172):
// Before:
// Last updated {format(lastUpdated, "P")}
// After:
// Last updated {lastUpdated.toLocaleDateString()}
```

- [ ] **Step 2: Check if date-fns can be fully removed**

Run: `grep -r "from \"date-fns\"" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`

If this was the only usage, also run:
```bash
bun remove date-fns
```

- [ ] **Step 3: Commit**

```bash
git add src/components/build/build-guide-section.tsx
git commit -m "perf: replace date-fns with native Intl.DateTimeFormat in client bundle"
```

---

### Task 4: Remove dead Recharts code

`src/components/ui/chart.tsx` imports Recharts but is never used by any component.

**Files:**
- Delete: `src/components/ui/chart.tsx`

- [ ] **Step 1: Verify chart.tsx is unused**

Run: `grep -r "chart" src/ --include="*.ts" --include="*.tsx" -l | grep -v "node_modules" | grep -v "ui/chart.tsx"`

Confirm no file imports from `@/components/ui/chart`.

- [ ] **Step 2: Delete chart.tsx and remove recharts**

```bash
rm src/components/ui/chart.tsx
bun remove recharts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused Recharts chart component"
```

---

### Task 5: Add O(1) mod/arcane lookup maps

Replace `getAllMods().find()` and `getAllArcanes().find()` with Map-based O(1) lookups.

**Files:**
- Modify: `src/lib/warframe/mods.ts:316-326,523-535`

- [ ] **Step 1: Add mod uniqueName lookup map**

After the `cachedArcanesBySlot` declaration (around line 17), add:

```typescript
let modByUniqueNameMap: Map<string, Mod> | null = null;
let arcaneByUniqueNameMap: Map<string, Arcane> | null = null;
```

- [ ] **Step 2: Refactor getModByUniqueName to use Map**

Replace the `getModByUniqueName` function (around line 316):

```typescript
export function getModByUniqueName(uniqueName: string): Mod | undefined {
  if (!modByUniqueNameMap) {
    modByUniqueNameMap = new Map(getAllMods().map((mod) => [mod.uniqueName, mod]));
  }
  return modByUniqueNameMap.get(uniqueName);
}
```

- [ ] **Step 3: Refactor getArcaneByUniqueName to use Map**

Replace the `getArcaneByUniqueName` function (around line 523):

```typescript
export function getArcaneByUniqueName(uniqueName: string): Arcane | undefined {
  if (!arcaneByUniqueNameMap) {
    arcaneByUniqueNameMap = new Map(getAllArcanes().map((a) => [a.uniqueName, a]));
  }
  return arcaneByUniqueNameMap.get(uniqueName);
}
```

- [ ] **Step 4: Verify tests pass**

Run: `bun test`
Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/warframe/mods.ts
git commit -m "perf: use O(1) Map lookups for mod/arcane by uniqueName"
```

---

### Task 6: Eliminate redundant ownership queries in server actions

`saveBuildAction` calls `getBuildById()` (full include) then `updateBuild()` which queries the build again. Consolidate by passing ownership check info directly to `updateBuild`.

**Files:**
- Modify: `src/app/actions/builds.ts:65-84`
- Modify: `src/app/actions/builds.ts:191-199`

- [ ] **Step 1: Remove redundant getBuildById in saveBuildAction**

Replace the update branch of `saveBuildAction` (lines 65-85):

```typescript
// If buildId is provided, update existing build
if (input.buildId) {
  const updateData: UpdateBuildInput = {
    name: input.name,
    description: input.description,
    visibility: input.visibility,
    buildData: input.buildData,
  };

  try {
    const build = await updateBuild(input.buildId, userId, updateData);
    return ok(build);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update build";
    return err(message);
  }
}
```

`updateBuild` already verifies ownership internally — the separate `getBuildById` check was redundant.

- [ ] **Step 2: Remove redundant getBuildById in updateBuildGuideAction**

Replace the entire body of `updateBuildGuideAction` (lines 182-225). The existing function has an outer try/catch — the replacement must preserve that structure without nesting another try/catch:

```typescript
export async function updateBuildGuideAction(
  buildId: string,
  input: UpdateBuildGuideInput
): Promise<SaveBuildResult> {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return err("You must be signed in to update a guide");
    }

    const userId = session.user.id;

    // Validate summary length
    if (input.summary && input.summary.length > MAX_SUMMARY_LENGTH) {
      return err(`Summary must be ${MAX_SUMMARY_LENGTH} characters or less`);
    }

    // Validate partner builds count
    if (input.partnerBuildIds && input.partnerBuildIds.length > MAX_PARTNER_BUILDS) {
      return err(`Maximum ${MAX_PARTNER_BUILDS} partner builds allowed`);
    }

    // updateBuild already verifies ownership — no need for a separate getBuildById call
    const build = await updateBuild(buildId, userId, {
      guideSummary: input.summary,
      guideDescription: input.description,
      partnerBuildIds: input.partnerBuildIds,
    });

    return ok(build);
  } catch (error) {
    console.error("Failed to update guide:", error);
    return err(getErrorMessage(error, "Failed to update guide"));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/builds.ts
git commit -m "perf: eliminate redundant ownership queries in build server actions"
```

---

### Task 7: Add page-level caching configuration

Add `revalidate` or `dynamic` exports to pages that are missing them.

**Files:**
- Modify: `src/app/builds/[slug]/page.tsx`
- Modify: `src/app/profile/[username]/page.tsx`

Note: `/builds` and `/create` are search-param-dependent dynamic pages — they should NOT be statically cached. The home page has no data fetching so it's already static by default. Individual build pages and profiles can use ISR.

- [ ] **Step 1: Add revalidate to build detail page**

In `src/app/builds/[slug]/page.tsx`, add after the imports:

```typescript
export const revalidate = 300; // 5 minutes — votes/views change frequently
```

- [ ] **Step 2: Add revalidate to profile page**

In `src/app/profile/[username]/page.tsx`, add after the imports:

```typescript
export const revalidate = 3600; // 1 hour
```

- [ ] **Step 3: Commit**

```bash
git add src/app/builds/\[slug\]/page.tsx src/app/profile/\[username\]/page.tsx
git commit -m "perf: add ISR revalidation to build detail and profile pages"
```

---

### Task 8: Add `getItemBySlugFromDb` limit and index

The current implementation fetches all candidates with ILIKE then filters in memory. Add a `take` limit.

**Files:**
- Modify: `src/lib/db/items.ts:61-81`

- [ ] **Step 1: Add take limit to getItemBySlugFromDb**

In `src/lib/db/items.ts`, modify `getItemBySlugFromDb` to add a result limit:

```typescript
export async function getItemBySlugFromDb(
  category: BrowseCategory,
  slug: string
): Promise<BrowseableItem | null> {
  const searchTerm = unslugify(slug);
  const candidates = await prisma.item.findMany({
    where: {
      browseCategory: category,
      name: { contains: searchTerm, mode: "insensitive" },
    },
    take: 20, // Limit candidates — slug collisions are rare
  });

  for (const item of candidates) {
    if (slugify(item.name) === slug) {
      return safeParseOrCast(ItemDataSchema, item.data, `item ${item.uniqueName}`) as BrowseableItem;
    }
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/items.ts
git commit -m "perf: add take limit to getItemBySlugFromDb query"
```

---

### Task 9: Add image fetch caching to Satori render

Cache fetched image data URIs so repeated build card renders don't re-fetch the same CDN images.

**Files:**
- Modify: `src/lib/image/render.ts:16-27`

- [ ] **Step 1: Add in-memory cache to fetchImageAsDataUri**

Add a module-level cache above the `fetchImageAsDataUri` function:

```typescript
// Cache fetched image data URIs to avoid re-fetching on repeated renders
const imageDataUriCache = new Map<string, string>();

async function fetchImageAsDataUri(url: string): Promise<string | undefined> {
  const cached = imageDataUriCache.get(url);
  if (cached) return cached;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") ?? "image/png";
    const dataUri = `data:${contentType};base64,${base64}`;
    imageDataUriCache.set(url, dataUri);
    return dataUri;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/image/render.ts
git commit -m "perf: cache Satori image fetches to avoid redundant CDN requests"
```

---

### Task 10: Add GIN index for full-text search vector

The `searchVector` tsvector column has no index, causing full table scans on search queries. Since Prisma can't manage tsvector indexes natively, add this as a post-push SQL script.

**Files:**
- Modify: `scripts/sync-wfcd-to-db.ts` (add index creation at the end of the sync script, so it's applied whenever data is synced)

- [ ] **Step 1: Add GIN index creation to the sync script**

At the end of `scripts/sync-wfcd-to-db.ts`, after all data has been synced, add:

```typescript
// Ensure GIN index exists for full-text search
await prisma.$executeRawUnsafe(`
  CREATE INDEX IF NOT EXISTS idx_builds_search_vector
  ON builds USING GIN("searchVector")
`);
console.log("✓ GIN index on searchVector ensured");
```

- [ ] **Step 2: Apply by re-syncing**

Run: `bun run db:sync`
This will sync data and create the GIN index.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-wfcd-to-db.ts
git commit -m "perf: add GIN index on builds.searchVector for full-text search"
```
