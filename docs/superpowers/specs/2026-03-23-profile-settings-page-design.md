# Profile Settings Page & Enhanced Profile View

**Date:** 2026-03-23
**Status:** Draft

## Overview

Add a `/settings` page for authenticated users to edit their profile (username, bio), and enhance the existing `/profile/[username]` page with a full browsable builds list including search and category filtering.

## Design

### 1. Settings Page (`/settings`)

**Route:** `src/app/settings/page.tsx` (Server Component)
**Auth:** Protected — redirects to `/auth/signin` if not logged in.

**Layout:**
- Page title: "Profile Settings"
- Card containing the edit form

**Form fields (using shadcn `FieldGroup` + `Field` pattern):**

| Field | Component | Validation | Notes |
|-------|-----------|------------|-------|
| Avatar | `Avatar` + `AvatarFallback` | N/A | Display-only. Shows GitHub avatar with "Synced from GitHub" note |
| Username | `Input` | Required, 3-20 chars, alphanumeric + hyphens/underscores, unique (server-side) | Uses Better Auth's username plugin API to update (preserves session consistency). Stores lowercase in `username`, original case in `displayUsername` |
| Bio | `Textarea` | Optional, max 300 chars | Character count shown. Updated via direct Prisma write (not managed by Better Auth) |

**Note on email:** Email is managed by Better Auth via GitHub OAuth and is not user-editable. Displayed as read-only for reference.

**Submit:** Save button using `useActionState` (React 19) for pending state. Success/error feedback via `sonner` toast.

**Client component:** The form itself needs `"use client"` for form state and submission handling. Wrap in a client component (`src/components/settings/settings-form.tsx`).

### 2. Enhanced Profile Page (`/profile/[username]`)

**Existing route stays the same.** Read-only for all visitors (including the profile owner).

**Top section (existing, minor updates):**
- Avatar, `displayUsername` (with fallback to `username`), role badge, bio, join date, stats
- Add "Edit Profile" button linking to `/settings` (only visible to profile owner)

**Builds section (new):**
- Search bar — filters builds by name (server-side query via server action)
- Category filter — `Select` component, options derived from `BROWSE_CATEGORIES` in `src/lib/warframe/categories.ts`
- Builds grid — responsive grid, server-side pagination with "Load more" button (12 per page)
- Empty state — use shadcn `Empty` component when no builds match filters
- Pass `viewerId` from session so profile owner can see their own private builds

**Data flow:** Client component calls a server action to fetch filtered/paginated builds. Initial page load fetches the first 12 via the server component. Subsequent loads (filter changes, load more) go through the server action.

### 3. Backend

**New server action file** (`src/app/actions/profile.ts`):
File starts with `"use server"` directive.

```
updateProfileAction(data: { username?: string, bio?: string })
```
- Rate limited (add `profileLimiter` to `src/lib/rate-limit.ts`)
- Validates input (zod schema)
- For username changes:
  - Checks uniqueness (case-insensitive, excluding current user)
  - Uses Better Auth username plugin API if available, otherwise direct Prisma update
  - Revalidates both old and new `/profile/[username]` paths
- For bio: direct Prisma update
- Returns success/error `Result` type

```
getProfileBuildsAction(userId: string, options: { query?: string, category?: string, cursor?: string })
```
- Public action (no auth required, only returns public builds unless viewer is owner)
- Returns paginated builds with `nextCursor`

**New/updated DB functions** (`src/lib/db/users.ts`):
- Add `import "server-only"` guard
- `updateUser(userId, data)` — updates bio (and username/displayUsername if not using Better Auth API)
- `isUsernameTaken(username, excludeUserId)` — case-insensitive uniqueness check
- Add `displayUsername` and `email` to `UserProfile` type and select queries
- New `UserProfileFull` type for settings page (includes email)

**Updated DB function** (`src/lib/db/builds.ts`):
- Wire up existing `query` and `category` fields in `GetBuildsOptions` within `getUserBuilds` — the type already supports them, the `where` clause just needs to apply them (similar to `getPublicBuilds`).

### 4. User Menu Update

Add "Settings" link to `src/components/auth/user-menu.tsx` dropdown, between "My Profile" and "My Builds", pointing to `/settings`.

### 5. Component Structure

```
src/
├── app/settings/
│   └── page.tsx                    # Server component, auth check, loads user data
├── components/settings/
│   ├── index.ts                    # Barrel export
│   └── settings-form.tsx           # "use client" form component
├── components/profile/
│   ├── index.ts                    # Barrel export
│   ├── profile-builds.tsx          # "use client" builds list with search/filter
│   └── profile-builds-filters.tsx  # Search + category filter controls
├── app/actions/
│   └── profile.ts                  # "use server" — updateProfileAction, getProfileBuildsAction
└── lib/db/
    └── users.ts                    # + updateUser, isUsernameTaken, UserProfileFull
```

### 6. Validation Schema

```typescript
// Inline in src/app/actions/profile.ts
const updateProfileSchema = z.object({
  username: z.string()
    .min(3).max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores")
    .optional(),
  bio: z.string().max(300).optional().or(z.literal("")),
})
```

### 7. shadcn Components Used

All already installed:
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`
- `Input`, `Textarea`
- `Button`, `Spinner` (for loading state)
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `Select`, `SelectTrigger`, `SelectContent`, `SelectGroup`, `SelectItem`
- `Badge` (role badge)
- `Separator`
- `Skeleton` (loading states)
- `Empty` (no builds found)
- `sonner` toast (save feedback)

### 8. Edge Cases

- **Username change → old URL:** Old `/profile/old-name` will 404. No redirect support for now (simple). The action revalidates both old and new paths.
- **Username taken:** Server action returns error, displayed inline on the username field via `data-invalid` + `aria-invalid`.
- **Session consistency:** Username updates go through Better Auth plugin API to keep session in sync. Bio is safe to update directly since it's not in the session object.
- **Profile owner viewing own profile:** Pass `viewerId` from `getServerSession()` to `getUserBuilds` so owner sees their private builds too.

## Out of Scope

- Custom avatar upload (stays GitHub-synced)
- Email editing (managed by GitHub OAuth)
- Email notifications / verification
- Privacy settings
- Theme preferences (already handled globally)
- Password management (GitHub OAuth only)
- Account deletion
- Old username redirects
