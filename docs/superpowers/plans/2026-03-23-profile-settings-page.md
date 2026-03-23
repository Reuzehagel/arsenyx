# Profile Settings Page & Enhanced Profile View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings` page for profile editing (username, bio) and enhance `/profile/[username]` with searchable, filterable builds.

**Architecture:** New `/settings` route with a client-side form that calls a server action for profile updates. Username changes go through Better Auth's `updateUser` API to keep sessions in sync; bio updates go through Prisma directly. The profile page gets a client component for builds with server-action-based search, category filtering, and page-based pagination.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma, Better Auth (username plugin), shadcn/ui (base-nova), Zod, sonner

**Spec:** `docs/superpowers/specs/2026-03-23-profile-settings-page-design.md`

---

## Task 1: Extend User DB Layer

**Files:**
- Modify: `src/lib/db/users.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: Add `server-only` import and extend `UserProfile` type**

In `src/lib/db/users.ts`, add `import "server-only"` at line 1. Add `displayUsername` to `UserProfile`. Create `UserProfileFull` type that includes `email` for the settings page.

```typescript
// Add at line 1:
import "server-only"

// Replace UserProfile (lines 13-21):
export interface UserProfile {
  id: string
  name: string | null
  username: string | null
  displayUsername: string | null
  image: string | null
  bio: string | null
  createdAt: Date
  role: string
}

// Add after UserProfile:
export interface UserProfileFull extends UserProfile {
  email: string
}
```

- [ ] **Step 2: Update existing select queries to include `displayUsername`**

In `getUserByUsername` and `getUserById`, add `displayUsername: true` to the `select` object.

- [ ] **Step 3: Add `getUserForSettings` function**

```typescript
export async function getUserForSettings(userId: string): Promise<UserProfileFull | null> {
  if (!prisma) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      displayUsername: true,
      image: true,
      bio: true,
      email: true,
      createdAt: true,
      role: true,
    },
  })
  return user
}
```

- [ ] **Step 4: Add `updateUserBio` and `isUsernameTaken` functions**

```typescript
export async function updateUserBio(userId: string, bio: string | null): Promise<void> {
  if (!prisma) return
  await prisma.user.update({
    where: { id: userId },
    data: { bio },
  })
}

export async function isUsernameTaken(username: string, excludeUserId: string): Promise<boolean> {
  if (!prisma) return false
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      id: { not: excludeUserId },
    },
    select: { id: true },
  })
  return !!existing
}
```

- [ ] **Step 5: Update barrel exports in `src/lib/db/index.ts`**

Add exports for `getUserForSettings`, `updateUserBio`, `isUsernameTaken`, and `UserProfileFull` type.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/users.ts src/lib/db/index.ts
git commit -m "feat: extend user DB layer with settings queries and username check"
```

---

## Task 2: Wire Up Build Filtering in `getUserBuilds`

**Files:**
- Modify: `src/lib/db/builds.ts`

- [ ] **Step 1: Add query and category filtering to `getUserBuilds` where clause**

In `src/lib/db/builds.ts`, the `getUserBuilds` function (line ~435) already accepts `GetBuildsOptions` which has `category` and `query` fields, but doesn't use them. Add them to the `where` clause, following the pattern from `getPublicBuilds` (lines 516-530):

```typescript
// In getUserBuilds, replace the where clause (lines 435-438) with:
const where: Prisma.BuildWhereInput = {
  userId,
  ...visibilityFilter,
  ...(options.category && {
    item: {
      browseCategory: options.category,
    },
  }),
  ...(options.query && {
    OR: [
      { title: { contains: options.query, mode: "insensitive" } },
      { item: { name: { contains: options.query, mode: "insensitive" } } },
    ],
  }),
}
```

- [ ] **Step 2: Verify the existing build tests still pass**

Run: `bun test`
Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/builds.ts
git commit -m "feat: wire up query and category filtering in getUserBuilds"
```

---

## Task 3: Add Rate Limiter and Profile Server Action

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Create: `src/app/actions/profile.ts`

- [ ] **Step 1: Add profile rate limiter**

In `src/lib/rate-limit.ts`, add after the existing limiters (line ~90):

```typescript
export const profileLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})
```

- [ ] **Step 2: Create the profile server action file**

Create `src/app/actions/profile.ts`:

```typescript
"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth, getServerSession } from "@/lib/auth"
import { isUsernameTaken, updateUserBio } from "@/lib/db"
import { profileLimiter, RateLimitError } from "@/lib/rate-limit"
import { err, getErrorMessage, ok, type Result } from "@/lib/result"

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Only letters, numbers, hyphens, and underscores",
    )
    .optional(),
  bio: z.string().max(300, "Bio must be at most 300 characters").optional().or(z.literal("")),
})

type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export async function updateProfileAction(
  input: UpdateProfileInput,
): Promise<Result> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return err("You must be signed in to update your profile")
    }

    await profileLimiter.check(10, session.user.id)

    const parsed = updateProfileSchema.safeParse(input)
    if (!parsed.success) {
      return err(parsed.error.errors[0]?.message ?? "Invalid input")
    }

    const { username, bio } = parsed.data
    const oldUsername = session.user.username

    // Update username via Better Auth API (keeps session in sync)
    if (username && username.toLowerCase() !== oldUsername?.toLowerCase()) {
      const taken = await isUsernameTaken(username, session.user.id)
      if (taken) {
        return err("Username is already taken")
      }

      await auth.api.updateUser({
        body: {
          username: username,
        },
        headers: await headers(),
      })
    }

    // Update bio directly (not managed by Better Auth)
    if (bio !== undefined) {
      await updateUserBio(session.user.id, bio || null)
    }

    // Revalidate profile and settings paths
    revalidatePath("/settings")
    if (oldUsername) {
      revalidatePath(`/profile/${oldUsername}`)
    }
    if (username && username.toLowerCase() !== oldUsername?.toLowerCase()) {
      revalidatePath(`/profile/${username.toLowerCase()}`)
    }

    return ok()
  } catch (error) {
    if (error instanceof RateLimitError) {
      return err("Too many requests. Please try again later.")
    }
    return err(getErrorMessage(error, "Failed to update profile"))
  }
}
```

**Note:** The Better Auth `updateUser` call uses `await headers()` from `next/headers` to forward the request cookies, following the same pattern as `getServerSession()` in `src/lib/auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rate-limit.ts src/app/actions/profile.ts
git commit -m "feat: add profile update server action with rate limiting"
```

---

## Task 4: Build the Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/components/settings/settings-form.tsx`
- Create: `src/components/settings/index.ts`

- [ ] **Step 1: Create the settings form client component**

Create `src/components/settings/settings-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { UserProfileFull } from "@/lib/db"
import { updateProfileAction } from "@/app/actions/profile"

interface SettingsFormProps {
  user: UserProfileFull
}

export function SettingsForm({ user }: SettingsFormProps) {
  const [username, setUsername] = useState(user.displayUsername ?? user.username ?? "")
  const [bio, setBio] = useState(user.bio ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const result = await updateProfileAction({
      username: username.trim(),
      bio: bio.trim(),
    })

    setIsPending(false)

    if (result.success) {
      toast.success("Profile updated")
    } else {
      setError(result.error)
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Update your public profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {/* Avatar (read-only) */}
            <Field>
              <FieldLabel>Avatar</FieldLabel>
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={user.image ?? undefined} alt={user.username ?? "Avatar"} />
                  <AvatarFallback>
                    {(user.displayUsername ?? user.username ?? "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <FieldDescription>Synced from your GitHub account</FieldDescription>
              </div>
            </Field>

            {/* Username */}
            <Field data-invalid={error?.toLowerCase().includes("username") || undefined}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
                minLength={3}
                maxLength={20}
                aria-invalid={error?.toLowerCase().includes("username") || undefined}
              />
              <FieldDescription>
                3-20 characters. Letters, numbers, hyphens, and underscores only.
              </FieldDescription>
              {error?.toLowerCase().includes("username") && (
                <FieldError>{error}</FieldError>
              )}
            </Field>

            {/* Bio */}
            <Field>
              <FieldLabel htmlFor="bio">Bio</FieldLabel>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                maxLength={300}
                rows={3}
              />
              <FieldDescription>{bio.length}/300</FieldDescription>
            </Field>

            {/* Email (read-only) */}
            <Field data-disabled>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={user.email} disabled />
              <FieldDescription>Managed by your GitHub account</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
```

- [ ] **Step 2: Create barrel export**

Create `src/components/settings/index.ts`:

```typescript
export { SettingsForm } from "./settings-form"
```

- [ ] **Step 3: Create the settings page server component**

Create `src/app/settings/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { getServerSession } from "@/lib/auth"
import { getUserForSettings } from "@/lib/db"
import { SettingsForm } from "@/components/settings"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/settings")
  }

  const user = await getUserForSettings(session.user.id)
  if (!user) {
    redirect("/auth/signin")
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <SettingsForm user={user} />
    </div>
  )
}
```

- [ ] **Step 4: Verify the page renders**

Run: `bun dev`
Navigate to `http://localhost:3000/settings` while logged in. Verify the form renders with current user data.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/page.tsx src/components/settings/settings-form.tsx src/components/settings/index.ts
git commit -m "feat: add settings page with profile edit form"
```

---

## Task 5: Add Settings Link to User Menu

**Files:**
- Modify: `src/components/auth/user-menu.tsx`

- [ ] **Step 1: Add Settings link to the dropdown menu**

In `src/components/auth/user-menu.tsx`, add a "Settings" link between "My Profile" and "My Builds" in the menu links section (around line 64-70). Use the existing `MenuLink` component (text-only, consistent with other menu items).

```tsx
<MenuLink href="/settings">Settings</MenuLink>
```

- [ ] **Step 2: Verify the link appears in the menu**

Run: `bun dev`
Click the user avatar. Verify "Settings" link appears and navigates to `/settings`.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/user-menu.tsx
git commit -m "feat: add settings link to user menu dropdown"
```

---

## Task 6: Add Profile Builds Server Action

**Files:**
- Modify: `src/app/actions/profile.ts`

- [ ] **Step 1: Add `getProfileBuildsAction` to the profile actions file**

Append to `src/app/actions/profile.ts`:

**Important:** `getUserBuilds` returns `{ builds: BuildListItem[]; total: number }`, not a plain array. Destructure accordingly and use `total` to determine if there are more pages.

```typescript
import { getUserBuilds, type BuildListItem, type GetBuildsOptions } from "@/lib/db"

interface ProfileBuildsResult {
  builds: BuildListItem[]
  hasMore: boolean
}

export async function getProfileBuildsAction(
  userId: string,
  options: { query?: string; category?: string; page?: number },
): Promise<Result<ProfileBuildsResult>> {
  try {
    const session = await getServerSession()
    const viewerId = session?.user?.id

    const limit = 12
    const page = options.page ?? 1
    const buildOptions: GetBuildsOptions = {
      page,
      limit,
      sortBy: "votes",
      ...(options.query && { query: options.query }),
      ...(options.category && options.category !== "all" && { category: options.category }),
    }

    const { builds, total } = await getUserBuilds(userId, viewerId, buildOptions)
    const hasMore = total > page * limit

    return ok({ builds, hasMore })
  } catch (error) {
    return err(getErrorMessage(error, "Failed to load builds"))
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/profile.ts
git commit -m "feat: add getProfileBuildsAction for paginated profile builds"
```

---

## Task 7: Build Profile Builds Components

**Files:**
- Create: `src/components/profile/profile-builds-filters.tsx`
- Create: `src/components/profile/profile-builds.tsx`
- Create: `src/components/profile/index.ts`

- [ ] **Step 1: Create the filters component**

Create `src/components/profile/profile-builds-filters.tsx`:

```tsx
"use client"

import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BROWSE_CATEGORIES } from "@/lib/warframe/categories"

interface ProfileBuildsFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
}

export function ProfileBuildsFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
}: ProfileBuildsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Search builds..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All Categories</SelectItem>
            {BROWSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.labelPlural}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
```

**Note:** `BROWSE_CATEGORIES` is safe to import in client components — it's a constant array with no `server-only` guard, and existing client components already import it.

- [ ] **Step 2: Create the profile builds list component**

Create `src/components/profile/profile-builds.tsx`.

**Important implementation notes:**
- `BuildCardLink` is imported directly from `@/components/build/build-card-link` (no barrel export exists for `src/components/build/`). It takes individual props (`slug`, `name`, `itemName`, `itemImageName`, `voteCount`, `viewCount`), NOT a single `build` object. Check `src/app/profile/[username]/page.tsx` lines 134-142 for the exact prop spreading pattern.
- `Empty` uses named exports (`Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`), NOT dot-notation (`Empty.Title`). Import them individually from `@/components/ui/empty`.
- The `useEffect` for debounced search must skip the initial mount to avoid re-fetching the server-rendered `initialBuilds`. Use a `hasInteracted` ref to track this.

```tsx
"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { BuildListItem } from "@/lib/db"
import { BuildCardLink } from "@/components/build/build-card-link"
import { getProfileBuildsAction } from "@/app/actions/profile"

import { ProfileBuildsFilters } from "./profile-builds-filters"

interface ProfileBuildsProps {
  userId: string
  initialBuilds: BuildListItem[]
  initialHasMore: boolean
}

export function ProfileBuilds({
  userId,
  initialBuilds,
  initialHasMore,
}: ProfileBuildsProps) {
  const [builds, setBuilds] = useState(initialBuilds)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [isPending, startTransition] = useTransition()
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const hasInteracted = useRef(false)

  const fetchBuilds = useCallback(
    (newSearch: string, newCategory: string, newPage: number, append: boolean) => {
      if (append) {
        setIsLoadingMore(true)
      }
      startTransition(async () => {
        const result = await getProfileBuildsAction(userId, {
          query: newSearch || undefined,
          category: newCategory !== "all" ? newCategory : undefined,
          page: newPage,
        })

        if (result.success) {
          if (append) {
            setBuilds((prev) => [...prev, ...result.data.builds])
          } else {
            setBuilds(result.data.builds)
          }
          setHasMore(result.data.hasMore)
          setPage(newPage)
        }
        setIsLoadingMore(false)
      })
    },
    [userId, startTransition],
  )

  // Debounced search — skip initial mount
  useEffect(() => {
    if (!hasInteracted.current) {
      hasInteracted.current = true
      return
    }
    const timer = setTimeout(() => {
      fetchBuilds(search, category, 1, false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, category, fetchBuilds])

  function handleLoadMore() {
    fetchBuilds(search, category, page + 1, true)
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileBuildsFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
      />

      {isPending && !isLoadingMore ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : builds.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No builds found</EmptyTitle>
            <EmptyDescription>
              {search || category !== "all"
                ? "Try adjusting your search or filters"
                : "This user hasn't created any builds yet"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {/* Spread individual props — check src/app/profile/[username]/page.tsx for exact pattern */}
            {builds.map((build) => (
              <BuildCardLink
                key={build.id}
                slug={build.slug}
                name={build.title}
                itemName={build.item.name}
                itemImageName={build.item.imageName}
                voteCount={build.voteCount}
                viewCount={build.viewCount}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore && <Spinner />}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Important:** The `BuildCardLink` prop names above are approximations. Verify the exact prop names by reading `src/components/build/build-card-link.tsx` and the existing usage in `src/app/profile/[username]/page.tsx`.

- [ ] **Step 3: Create barrel export**

Create `src/components/profile/index.ts`:

```typescript
export { ProfileBuilds } from "./profile-builds"
export { ProfileBuildsFilters } from "./profile-builds-filters"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/profile-builds.tsx src/components/profile/profile-builds-filters.tsx src/components/profile/index.ts
git commit -m "feat: add profile builds components with search and category filter"
```

---

## Task 8: Enhance the Profile Page

**Files:**
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Update imports and data loading**

Add imports for `getServerSession`, `ProfileBuilds`, `Link`, and `Button`. Update the data loading to pass `viewerId` from session and use `total` for pagination:

```tsx
// Add to imports:
import Link from "next/link"
import { getServerSession } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ProfileBuilds } from "@/components/profile"

// In the component body, get session and pass viewerId:
const session = await getServerSession()
const viewerId = session?.user?.id

// Update getUserBuilds call to pass viewerId and get total:
const { builds, total } = await getUserBuilds(user.id, viewerId, { limit: 12, sortBy: "votes" })
const hasMore = total > 12
```

- [ ] **Step 2: Add "Edit Profile" button for profile owner**

In the profile header section, after the stats or bio area. This project uses base-nova (not radix), so use `Link` directly styled as a button instead of `asChild`:

```tsx
{session?.user?.id === user.id && (
  <Link
    href="/settings"
    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
  >
    Edit Profile
  </Link>
)}
```

Alternatively, check if `Button` in this codebase supports `render` prop for polymorphism, and use that if available.

- [ ] **Step 3: Replace the static builds grid with `ProfileBuilds`**

Replace the existing builds section (the grid that shows top 12 builds) with:

```tsx
<ProfileBuilds
  userId={user.id}
  initialBuilds={builds}
  initialHasMore={hasMore}
/>
```

- [ ] **Step 4: Use `displayUsername` where appropriate**

Update the profile header to show `displayUsername` (with fallback to `username`) for display purposes.

- [ ] **Step 5: Verify the enhanced profile page**

Run: `bun dev`
Navigate to a user's profile. Verify:
- Search bar and category filter appear
- Filtering works (with debounced search)
- "Load More" appears when there are more than 12 builds
- "Edit Profile" button appears only on your own profile
- "Edit Profile" navigates to `/settings`

- [ ] **Step 6: Commit**

```bash
git add src/app/profile/[username]/page.tsx
git commit -m "feat: enhance profile page with build search, filters, and edit link"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run linter**

Run: `bun lint`
Expected: No errors.

- [ ] **Step 2: Run formatter**

Run: `bun fmt`

- [ ] **Step 3: Run tests**

Run: `bun test`
Expected: All existing tests pass.

- [ ] **Step 4: Run build**

Run: `bun build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Manual smoke test**

1. Sign in with GitHub
2. Navigate to `/settings` — verify form shows current data
3. Change bio, save — verify toast and profile page reflects change
4. Change username, save — verify new profile URL works
5. Navigate to your profile — verify "Edit Profile" button
6. Search builds by name — verify filtering
7. Filter by category — verify filtering
8. Click "Load More" if you have >12 builds
9. Visit another user's profile — verify no "Edit Profile" button, builds are searchable

- [ ] **Step 6: Commit any formatting/lint fixes**

```bash
git add -A
git commit -m "chore: lint and format fixes"
```
