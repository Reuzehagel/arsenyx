# Organizations Feature Design

Collaborative build publishing under shared organization handles. Org members can create, edit, and delete builds published under the org's identity.

## Data Model

### New Models

**Organization**

| Field         | Type     | Notes                            |
|---------------|----------|----------------------------------|
| id            | cuid     | Primary key                      |
| name          | String   | Display name (e.g. "PT Community") |
| slug          | String   | Unique, lowercase, URL-safe      |
| image         | String?  | Avatar URL (nullable)            |
| description   | String?  | Short description (nullable)     |
| createdAt     | DateTime |                                  |
| updatedAt     | DateTime |                                  |

Relations: `members` (OrganizationMember[]), `builds` (Build[])

**OrganizationMember**

| Field          | Type     | Notes                              |
|----------------|----------|------------------------------------|
| organizationId | String   | FK to Organization                 |
| userId         | String   | FK to User                         |
| role           | Enum     | ADMIN or MEMBER                    |
| joinedAt       | DateTime |                                    |

Compound unique on `(organizationId, userId)`.

- **ADMIN**: Can edit org settings, add/remove members, promote/demote roles. Full build access.
- **MEMBER**: Full build access (create, edit, delete org builds). Cannot manage org settings or members.

### Modified Models

**Build** — add `organizationId` (nullable FK to Organization):

- When set: the org owns the build. Any org member can edit/delete. Displayed as "by OrgName".
- When null: normal user-owned build. Works exactly like today.
- `userId` is always set (the creator) but is informational when `organizationId` is set.

**User** — replace `role` enum with boolean flags:

| Field             | Type    | Default | Purpose                        |
|-------------------|---------|---------|--------------------------------|
| isVerified        | Boolean | false   | Game knowledge, knows what they're doing |
| isCommunityLeader | Boolean | false   | Can create organizations       |
| isModerator       | Boolean | false   | Can moderate content           |
| isAdmin           | Boolean | false   | Site admin, full access        |

Drop the existing `role` enum. Flags are independent — a user can be verified AND a community leader. Migration: map existing enum values to corresponding flags.

### Permissions

**Build permissions:**

```
canEditBuild(build, userId):
  build.userId === userId
  OR (build.organizationId && userIsOrgMember(build.organizationId, userId))

canDeleteBuild(build, userId):
  same as canEditBuild (trust-based)
```

**Org permissions:**

- Create org: `user.isCommunityLeader || user.isAdmin`
- Edit org settings: org ADMIN only
- Add/remove members: org ADMIN only
- Promote/demote roles: org ADMIN only
- Create/edit/delete org builds: any org member (ADMIN or MEMBER)

**Guard rails:**

- Cannot remove yourself if you're the last admin
- Members are added by username — user must have an existing Arsenyx account

## Routes

### New Routes

**`/org/[slug]`** — Org profile page

- Org name, avatar (if set), description (if set)
- Member list: avatar, display name, role badge (Admin/Member), linked to `/profile/[username]`
- Paginated list of org's public builds (sorted by votes, 12 per page)
- If viewer is a member: link to org settings

**`/org/[slug]/settings`** — Org settings (admin only)

- **General section**: Edit name, slug, avatar URL, description
- **Members section**: List current members with role. Add member by username search. Remove member (with confirmation). Promote/demote between ADMIN and MEMBER.
- **Danger zone**: Delete organization (with confirmation). On deletion, all org builds are orphaned back to their original creators (`organizationId` set to null). All OrganizationMember rows cascade-delete with the org.

**`/settings/organizations`** — Section on existing user settings page

- List orgs the user belongs to, with their role in each
- "Create Organization" button (visible only if `isCommunityLeader` or `isAdmin`)
- Create org flow: name, slug (auto-generated from name, editable), optional image URL and description

### Modified Routes

**`/create`** — Build editor

- Add "Publish as" control: dropdown with the user's own name (default) and each org they belong to
- Only visible if user is in at least one org
- Selection sets `organizationId` on save

**`/builds/[slug]`** — Build detail page

- When `organizationId` is set: show "ORG PT Community" (purple badge + org name, linked to `/org/[slug]`) instead of "by Username"
- When null: show "by Username" as today

**`/browse/[category]/[slug]`** — Community builds section

- Org builds show the ORG badge + org name in the subtitle instead of "by Username"

## Visual Treatment

**ORG badge**: Small purple pill (`background: #7c3aed`, white text, `font-size: 9px`, `padding: 1px 5px`, `border-radius: 3px`, `font-weight: 600`) with text "ORG". Placed before the org name.

**Org name**: Styled in purple (`color: #a78bfa`) to distinguish from regular author names in muted gray.

**Build cards**: Replace `by Username` subtitle with `[ORG] OrgName` for org builds.

**Build detail header**: Replace `by Username` span with badge + linked org name.

**Org profile page**: Same structural layout as user profile — name/avatar header, stats, paginated build list.

## Database Migration

This requires a schema reset (dropping enum, adding columns and new tables).

**Migration steps:**

1. Note existing user roles from prod (likely just admin for you)
2. Reset database (`db:push --force-reset`)
3. Re-run `setup-search.sql`
4. Re-set your admin flag (`isAdmin: true`)

Low risk — prod currently has minimal user data (primarily your account).

## Scope

### In scope

- Organization and OrganizationMember Prisma models
- User role refactor (single enum to boolean flags)
- Org CRUD gated behind isCommunityLeader/isAdmin
- Add/remove members by username (org admin only)
- Promote/demote member roles (org admin only)
- Org profile page (`/org/[slug]`)
- Org settings page (`/org/[slug]/settings`)
- "Publish as" picker in build editor
- Org build display with ORG badge
- Updated build permission checks for org membership
- On org deletion, orphan builds back to creators
- Organizations section on user settings page

### Out of scope

- Admin/dev panel (tracked in TODO.md as follow-up)
- Invite links / join requests
- Org-level analytics or stats
- Org guides (builds only)
- Transfer build ownership between user and org
- Org discovery / browse orgs page
- Notifications for org activity
