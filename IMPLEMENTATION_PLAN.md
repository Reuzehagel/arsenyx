# Arsenix Implementation Plan

> Comprehensive plan for adding database persistence, authentication, data synchronization, and social features to Arsenix.

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Database Schema](#3-database-schema)
4. [Authentication](#4-authentication)
5. [WFCD Data Sync](#5-wfcd-data-sync)
6. [Build System](#6-build-system)
7. [Social Features](#7-social-features)
8. [Guides System](#8-guides-system)
9. [Image Generation API](#9-image-generation-api)
10. [Caching Strategy](#10-caching-strategy)
11. [Migration Plan](#11-migration-plan)
12. [Environment Variables](#12-environment-variables)
13. [Implementation Order](#13-implementation-order)
14. [Appendix A: File Structure](#appendix-a-file-structure)
15. [Appendix B: Glossary](#appendix-b-glossary)
16. [Appendix C: Testing Strategy](#appendix-c-testing-strategy)

---

## 1. Overview

### Current State

- **Item data**: 17.7MB of static JSON files imported at server startup from `@wfcd/items`
- **Build storage**: localStorage + base64 URL sharing
- **Auth**: None
- **Guides**: Lexical editor content stored in localStorage
- **Social**: None

### Target State

- **Item data**: Postgres database with scheduled sync from WFCD
- **Build storage**: Database with user ownership, visibility controls, linking
- **Auth**: NextAuth with Email + GitHub providers
- **Guides**: Database-backed with build embedding support
- **Social**: Votes, favorites (comments deferred to future)

### Key Decisions

| Decision      | Choice                              | Rationale                                    |
| ------------- | ----------------------------------- | -------------------------------------------- |
| Database      | Postgres (Neon free tier, portable) | Standard SQL, Prisma support, easy migration |
| ORM           | Prisma                              | Type-safe, migrations, works everywhere      |
| Auth          | NextAuth v5                         | Standard, low lock-in, Prisma adapter        |
| Dev DB        | Docker Postgres                     | Avoids burning free tier during dev          |
| Image storage | Cloudflare R2 / Vercel Blob         | Keep binary data out of DB                   |

---

## 2. Tech Stack

### Dependencies to Add

```bash
# Database
bun add -D prisma
bun add @prisma/client

# Auth
bun add next-auth@beta @auth/prisma-adapter

# Email (for magic links)
bun add nodemailer
bun add -D @types/nodemailer

# Rate limiting
bun add @upstash/ratelimit @upstash/redis
# OR for simpler setup without Redis:
bun add lru-cache

# Image generation (separate service or serverless)
bun add puppeteer-core @sparticuz/chromium
```

### Docker Compose for Local Dev

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: arsenix-db
    environment:
      POSTGRES_USER: arsenix
      POSTGRES_PASSWORD: arsenix_dev
      POSTGRES_DB: arsenix
    ports:
      - "5432:5432"
    volumes:
      - arsenix_postgres_data:/var/lib/postgresql/data

volumes:
  arsenix_postgres_data:
```

Local `DATABASE_URL`:
```
postgresql://arsenix:arsenix_dev@localhost:5432/arsenix
```

### Operational Defaults

- Connection pooling: use Prisma Accelerate/Data Proxy (or Neon pooler) for serverless to avoid exhausting Postgres connections.
- Backups: nightly Neon branch snapshot; keep 7–14 days; document restore steps and test quarterly.
- Preview environments: per-PR Neon branch created from `main` migration state; inject `DATABASE_URL` per preview to avoid clobbering shared dev data.
- Monitoring: Sentry for errors + basic cron heartbeat for WFCD sync; log WFCD sync results to `WfcdSyncLog` and surface in admin UI.

---

## 3. Database Schema

### 3.1 Prisma Schema

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================================================================
// AUTH (NextAuth required tables)
// =============================================================================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  // App-specific fields
  username      String?   @unique  // Display name / handle
  usernameLower String?   @unique  // Enforce lowercase uniqueness
  bio           String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts      Account[]
  sessions      Session[]
  builds        Build[]
  votes         BuildVote[]
  favorites     BuildFavorite[]
  guideVotes    GuideVote[]
  guideFavorites GuideFavorite[]
  guides        Guide[]
  apiKeys       ApiKey[]

  role          Role      @default(USER)

  @@map("users")
}

enum Role {
  USER
  VERIFIED
  DEVELOPER
  MODERATOR
  ADMIN
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// =============================================================================
// WARFRAME DATA (synced from WFCD)
// =============================================================================

model Item {
  id              String   @id @default(cuid())
  uniqueName      String   @unique  // WFCD unique identifier
  name            String
  description     String?
  imageName       String?
  category        String   // "Warframes", "Primary", "Secondary", "Melee", etc.
  browseCategory  String   // "warframes", "primary", "secondary", "melee", etc.

  // Common fields
  tradable        Boolean  @default(false)
  masteryReq      Int?
  isPrime         Boolean  @default(false)
  vaulted         Boolean  @default(false)
  releaseDate     DateTime?

  // Full WFCD data as JSON (stats, abilities, etc.)
  data            Json

  // Warframe-specific: can use archon shards
  supportsShards  Boolean  @default(false)

  // Sync metadata
  wfcdVersion     String?  // Track which WFCD version this came from
  syncedAt        DateTime @default(now())

  // Relations
  builds          Build[]

  @@index([browseCategory])
  @@index([name])
  @@map("items")
}

model Mod {
  id           String   @id @default(cuid())
  uniqueName   String   @unique
  name         String
  description  String?
  imageName    String?
  polarity     String   // "madurai", "vazarin", etc.
  rarity       String   // "Common", "Uncommon", "Rare", "Legendary"
  baseDrain    Int
  fusionLimit  Int
  compatName   String?  // "Warframe", "Rifle", "Melee", etc.
  type         String   // "Warframe Mod", "Primary Mod", etc.
  tradable     Boolean  @default(false)
  isAugment    Boolean  @default(false)
  isPrime      Boolean  @default(false)
  isExilus     Boolean  @default(false)

  // Full WFCD data as JSON (levelStats, drops, etc.)
  data         Json

  // Sync metadata
  syncedAt     DateTime @default(now())

  @@index([compatName])
  @@index([type])
  @@index([name])
  @@map("mods")
}

model Arcane {
  id          String   @id @default(cuid())
  uniqueName  String   @unique
  name        String
  description String?
  imageName   String?
  rarity      String
  type        String   // "Warframe", "Operator", "Weapon", etc.
  tradable    Boolean  @default(false)

  // Full WFCD data as JSON
  data        Json

  // Sync metadata
  syncedAt    DateTime @default(now())

  @@index([type])
  @@index([name])
  @@map("arcanes")
}

// Track WFCD sync history
model WfcdSyncLog {
  id           String   @id @default(cuid())
  startedAt    DateTime @default(now())
  completedAt  DateTime?
  status       String   // "running", "completed", "failed"
  itemsUpdated Int      @default(0)
  modsUpdated  Int      @default(0)
  arcanesUpdated Int    @default(0)
  error        String?
  triggeredBy  String?  // "cron", "manual", "webhook"

  @@map("wfcd_sync_logs")
}

// =============================================================================
// BUILDS
// =============================================================================

enum BuildVisibility {
  PUBLIC
  PRIVATE
  UNLISTED
}

model Build {
  id           String          @id @default(cuid())
  slug         String          @unique  // URL-friendly identifier

  // Ownership
  userId       String
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Item reference
  itemId       String
  item         Item            @relation(fields: [itemId], references: [id])

  // Build metadata
  name         String
  description  String?
  visibility   BuildVisibility @default(PUBLIC)

  // The actual build configuration (stored as JSON)
  // Contains: slots, mods, arcanes, shards, reactor, forma, etc.
  buildData    Json

  // Archon shards (for warframes) - stored in buildData but also indexed here for queries
  hasShards    Boolean         @default(false)

  // Denormalized counts for performance
  voteCount     Int             @default(0)
  favoriteCount Int             @default(0)
  viewCount     Int             @default(0)

  // Forking
  forkedFromId String?
  forkedFrom   Build?          @relation("BuildForks", fields: [forkedFromId], references: [id], onDelete: SetNull)
  forks        Build[]         @relation("BuildForks")

  // Timestamps
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  // Relations
  votes        BuildVote[]
  favorites    BuildFavorite[]
  linkedFrom   BuildLink[]     @relation("LinkedFromBuild")
  linkedTo     BuildLink[]     @relation("LinkedToBuild")
  guideEmbeds  GuideEmbed[]

  // Build guide (rich text explanation for this specific build)
  buildGuide   BuildGuide?

  @@index([userId])
  @@index([itemId])
  @@index([visibility])
  @@index([voteCount])
  @@index([createdAt])
  @@map("builds")
}

// Build guide - rich text attached to a build
model BuildGuide {
  id        String   @id @default(cuid())
  buildId   String   @unique
  build     Build    @relation(fields: [buildId], references: [id], onDelete: Cascade)

  // Lexical editor serialized state
  content   Json

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("build_guides")
}

// Link builds together (e.g., Warframe build references weapon builds)
model BuildLink {
  id            String   @id @default(cuid())

  // The parent build (e.g., Warframe build)
  fromBuildId   String
  fromBuild     Build    @relation("LinkedFromBuild", fields: [fromBuildId], references: [id], onDelete: Cascade)

  // The linked build (e.g., weapon build)
  toBuildId     String
  toBuild       Build    @relation("LinkedToBuild", fields: [toBuildId], references: [id], onDelete: Cascade)

  // Optional label (e.g., "Primary Weapon", "Companion")
  label         String?

  // Order for display
  sortOrder     Int      @default(0)

  createdAt     DateTime @default(now())

  @@unique([fromBuildId, toBuildId])
  @@map("build_links")
}

// =============================================================================
// BUILD DATA JSON STRUCTURE (for reference - stored in Build.buildData)
// =============================================================================
// {
//   "itemUniqueName": "/Lotus/Powersuits/Trinity/Trinity",
//   "itemName": "Trinity",
//   "itemCategory": "warframes",
//   "itemImageName": "trinity.png",
//
//   "hasReactor": true,
//
//   "auraSlot": {
//     "id": "aura-0",
//     "type": "aura",
//     "innatePolarity": "vazarin",
//     "formaPolarity": null,
//     "mod": { "uniqueName": "...", "name": "...", "rank": 5, ... }
//   },
//
//   "exilusSlot": { ... },
//
//   "normalSlots": [
//     { "id": "normal-0", "type": "normal", "innatePolarity": "madurai", "formaPolarity": "vazarin", "mod": {...} },
//     { "id": "normal-1", ... },
//     // ... 8 slots total
//   ],
//
//   "arcaneSlots": [
//     { "uniqueName": "...", "name": "Arcane Energize", "rank": 5, "rarity": "Legendary" },
//     { "uniqueName": "...", "name": "Arcane Grace", "rank": 5, "rarity": "Legendary" }
//   ],
//
//   "shardSlots": [
//     { "type": "crimson", "variant": "tauforged", "bonus": "+25% Ability Strength" },
//     { "type": "azure", "variant": "normal", "bonus": "+150 Energy Max" },
//     // ... up to 5 slots
//   ],
//
//   "baseCapacity": 60,
//   "currentCapacity": 4,
//   "formaCount": 3
// }

// =============================================================================
// SOCIAL FEATURES
// =============================================================================

model BuildVote {
  id        String   @id @default(cuid())

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  buildId   String
  build     Build    @relation(fields: [buildId], references: [id], onDelete: Cascade)

  // +1 for upvote (keeping it simple, no downvotes)
  value     Int      @default(1)

  createdAt DateTime @default(now())

  @@unique([userId, buildId])
  @@map("build_votes")
}

model BuildFavorite {
  id        String   @id @default(cuid())

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  buildId   String
  build     Build    @relation(fields: [buildId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, buildId])
  @@map("build_favorites")
}

// =============================================================================
// GUIDES (general guides, not build-specific)
// =============================================================================

model Guide {
  id            String       @id @default(cuid())
  slug          String       @unique

  // Ownership
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Content
  title         String
  summary       String
  category      String       // "systems", "resources", "modes", "warframes", "gear"
  tags          String[]
  coverImage    String?

  // Lexical editor serialized state
  content       Json

  // Status
  status        String       @default("draft")  // "draft" | "published"
  isCurated     Boolean      @default(false)    // Featured/official guides

  // Computed
  readingTime   Int          @default(1)        // Minutes
  viewCount     Int          @default(0)
  voteCount     Int          @default(0)
  favoriteCount Int          @default(0)

  // Timestamps
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  publishedAt   DateTime?

  // Relations
  embeds        GuideEmbed[]
  votes         GuideVote[]
  favorites     GuideFavorite[]

  @@index([category])
  @@index([status])
  @@index([userId])
  @@map("guides")
}

// Embed builds within guides
model GuideEmbed {
  id        String   @id @default(cuid())

  guideId   String
  guide     Guide    @relation(fields: [guideId], references: [id], onDelete: Cascade)

  buildId   String
  build     Build    @relation(fields: [buildId], references: [id], onDelete: Cascade)

  // Position/label within guide
  label     String?
  sortOrder Int      @default(0)

  createdAt DateTime @default(now())

  @@unique([guideId, buildId])
  @@map("guide_embeds")
}

model GuideVote {
  id        String   @id @default(cuid())

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  guideId   String
  guide     Guide    @relation(fields: [guideId], references: [id], onDelete: Cascade)

  value     Int      @default(1)

  createdAt DateTime @default(now())

  @@unique([userId, guideId])
  @@map("guide_votes")
}

model GuideFavorite {
  id        String   @id @default(cuid())

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  guideId   String
  guide     Guide    @relation(fields: [guideId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([userId, guideId])
  @@map("guide_favorites")
}

// =============================================================================
// IMAGE GENERATION API
// =============================================================================

model ApiKey {
  id          String    @id @default(cuid())

  // Owner (admin who created the key)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Key details
  name        String    // "Profit-Taker Discord Bot", etc.
  key         String    @unique  // The actual API key (hashed)
  keyPrefix   String    // First 8 chars for identification (e.g., "ask_abc1...")

  // Permissions
  scopes      String[]  // ["image:generate", "build:read"]

  // Rate limiting
  rateLimit   Int       @default(100)  // Requests per hour

  // Status
  isActive    Boolean   @default(true)
  lastUsedAt  DateTime?

  // Timestamps
  createdAt   DateTime  @default(now())
  expiresAt   DateTime?

  @@map("api_keys")
}

// Track generated images (optional, for caching)
model GeneratedImage {
  id          String   @id @default(cuid())

  // What was rendered
  buildId     String
  template    String   // "full", "compact", "mods-only", etc.
  options     Json?    // { showStats: true, showShards: true, ... }

  // Result
  imageUrl    String   // R2/Blob URL
  width       Int
  height      Int

  // Cache management
  createdAt   DateTime @default(now())
  expiresAt   DateTime // Auto-delete after X days

  @@unique([buildId, template, options])
  @@map("generated_images")
}
```

### 3.2 Archon Shards Data Structure

Shards are stored in `Build.buildData.shardSlots`:

```typescript
interface ShardSlot {
  type: "crimson" | "azure" | "amber" | "tau" | "topaz";
  variant: "normal" | "tauforged";
  bonus: string;  // Description of the bonus
}

// Example
const shardSlots: ShardSlot[] = [
  { type: "crimson", variant: "tauforged", bonus: "+25% Ability Strength" },
  { type: "azure", variant: "normal", bonus: "+150 Energy Max" },
  { type: "amber", variant: "normal", bonus: "+50% Casting Speed" },
  // Up to 5 slots for Warframes
];
```

Note: Only Warframes support shards. The `Item.supportsShards` field tracks this.

---

## 4. Authentication

### 4.1 NextAuth Configuration

Create `src/lib/auth.ts`:

```typescript
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GitHub from "next-auth/providers/github";
import Email from "next-auth/providers/email";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.username = user.username;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },
});

/*
  Role-Based Access Control (RBAC):
  - ADMIN: Full access, can manage API keys and user roles.
  - MODERATOR: Can moderate content (delete/ban) and has DEVELOPER access.
  - DEVELOPER: Can manage API keys/access restricted APIs. No moderation powers.
  - VERIFIED: Trusted builder. Can upload custom cover images for guides. Validated badge.
  - USER: Standard access. Can create builds/guides but restricted from uploading custom images.
*/
```

### 4.2 Auth Route Handler

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

### 4.3 Session Access

Server components:
```typescript
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();
  if (!session?.user) {
    // Not authenticated
  }
}
```

Client components:
```typescript
"use client";
import { useSession } from "next-auth/react";

export function Component() {
  const { data: session, status } = useSession();
}
```

### 4.4 Roles and Moderation

- Authorization rules:
  - `USER`: standard permissions (own builds/guides CRUD, delete own content).
  - `MODERATOR` and above: can delete/flag any build/guide, trigger WFCD sync, view admin dashboards.
  - `ADMIN`: manage API keys for others, grant roles.
- Enforce role checks in server actions (build delete/update for non-owners, guide moderation, API key creation, manual sync endpoint).
- Normalize usernames to lowercase on creation/update; store both display casing and a `usernameLower` field for uniqueness checks.

### 4.5 Account Deletion

When a user deletes their account, **cascade delete** all their data:

- All builds owned by the user are deleted
- All votes cast by the user are deleted (and denormalized counts decremented)
- All favorites are deleted (and denormalized counts decremented)
- All guides owned by the user are deleted
- All API keys owned by the user are revoked
- Build links where user's builds are involved are deleted
- Guide embeds referencing user's builds are deleted

Implementation:

```typescript
export async function deleteAccount(userId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    throw new Error("Not authorized");
  }

  // Prisma cascades will handle most relations due to onDelete: Cascade
  // But we need to manually decrement denormalized counts first

  // Get all builds to decrement their vote/favorite counts
  const userVotes = await prisma.buildVote.findMany({ where: { userId } });
  const userFavorites = await prisma.buildFavorite.findMany({ where: { userId } });
  const userGuideVotes = await prisma.guideVote.findMany({ where: { userId } });
  const userGuideFavorites = await prisma.guideFavorite.findMany({ where: { userId } });

  await prisma.$transaction([
    // Decrement build vote counts
    ...userVotes.map(v => prisma.build.update({
      where: { id: v.buildId },
      data: { voteCount: { decrement: 1 } },
    })),
    // Decrement build favorite counts
    ...userFavorites.map(f => prisma.build.update({
      where: { id: f.buildId },
      data: { favoriteCount: { decrement: 1 } },
    })),
    // Decrement guide vote counts
    ...userGuideVotes.map(v => prisma.guide.update({
      where: { id: v.guideId },
      data: { voteCount: { decrement: 1 } },
    })),
    // Decrement guide favorite counts
    ...userGuideFavorites.map(f => prisma.guide.update({
      where: { id: f.guideId },
      data: { favoriteCount: { decrement: 1 } },
    })),
    // Delete user (cascades to all related records)
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
```

Note: Builds that were forked from a deleted user's build will have `forkedFromId` set to `null` (due to `onDelete: SetNull`).

---

## 5. WFCD Data Sync

### 5.1 Sync Strategy

Instead of static JSON imports, sync WFCD data to the database:

1. **Initial seed**: Populate Items, Mods, Arcanes from `@wfcd/items`
2. **Scheduled sync**: Daily/weekly cron job to update from latest WFCD
3. **Manual trigger**: Admin endpoint to force sync
4. **Version tracking**: Read `@wfcd/items` package version (or commit hash if available) and store on `WfcdSyncLog` + `Item/Mod/Arcane.wfcdVersion`. Keep only latest data; delete records whose `uniqueName` disappeared in new payloads (soft-delete flag first, hard delete after a grace window if needed).
5. **Cache invalidation**: After a successful sync, revalidate cache tags (`items`, `mods`, `arcanes`) and rebuild any denormalized summaries used by browse pages.

### 5.2 Sync Script

Create `scripts/sync-wfcd-to-db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
// Import from @wfcd/items or read from node_modules JSON
import WarframesData from "../node_modules/@wfcd/items/data/json/Warframes.json";
import ModsData from "../node_modules/@wfcd/items/data/json/Mods.json";
import ArcanesData from "../node_modules/@wfcd/items/data/json/Arcanes.json";
// ... other data files

const prisma = new PrismaClient();

async function syncItems() {
  const log = await prisma.wfcdSyncLog.create({
    data: { status: "running", triggeredBy: "manual" },
  });

  try {
    // Warframes
    for (const wf of WarframesData) {
      await prisma.item.upsert({
        where: { uniqueName: wf.uniqueName },
        create: {
          uniqueName: wf.uniqueName,
          name: wf.name,
          description: wf.description,
          imageName: wf.imageName,
          category: "Warframes",
          browseCategory: "warframes",
          tradable: wf.tradable ?? false,
          masteryReq: wf.masteryReq,
          isPrime: wf.isPrime ?? false,
          vaulted: wf.vaulted ?? false,
          releaseDate: wf.releaseDate ? new Date(wf.releaseDate) : null,
          supportsShards: true, // Warframes support shards
          data: wf as any,
        },
        update: {
          name: wf.name,
          data: wf as any,
          syncedAt: new Date(),
        },
      });
    }

    // Mods
    for (const mod of ModsData) {
      if (!mod.baseDrain || !mod.fusionLimit) continue; // Skip invalid mods

      await prisma.mod.upsert({
        where: { uniqueName: mod.uniqueName },
        create: {
          uniqueName: mod.uniqueName,
          name: mod.name,
          description: mod.description,
          imageName: mod.imageName,
          polarity: mod.polarity?.toLowerCase() ?? "universal",
          rarity: mod.rarity ?? "Common",
          baseDrain: mod.baseDrain,
          fusionLimit: mod.fusionLimit,
          compatName: mod.compatName,
          type: mod.type ?? "Unknown",
          tradable: mod.tradable ?? false,
          isAugment: mod.isAugment ?? false,
          isPrime: mod.name?.startsWith("Primed ") ?? false,
          isExilus: mod.isExilus ?? false,
          data: mod as any,
        },
        update: {
          name: mod.name,
          data: mod as any,
          syncedAt: new Date(),
        },
      });
    }

    // Arcanes (similar pattern)
    // ...

    await prisma.wfcdSyncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        itemsUpdated: WarframesData.length,
        modsUpdated: ModsData.length,
      },
    });

  } catch (error) {
    await prisma.wfcdSyncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: String(error),
      },
    });
    throw error;
  }
}

syncItems();
```

### 5.3 Cron Job Setup

For Vercel, use Vercel Cron Jobs in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-wfcd",
      "schedule": "0 4 * * *"
    }
  ]
}
```

Create `src/app/api/cron/sync-wfcd/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { syncWfcdData } from "@/lib/wfcd/sync";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncWfcdData();
  return NextResponse.json({ success: true });
}
```

### 5.4 Data Access Layer

Replace static imports with database queries:

Create `src/lib/db/items.ts`:

```typescript
import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";

export const getItemsByCategory = unstable_cache(
  async (category: string) => {
    return prisma.item.findMany({
      where: { browseCategory: category },
      orderBy: { name: "asc" },
    });
  },
  ["items-by-category"],
  { revalidate: 3600, tags: ["items"] }
);

export const getItemByUniqueName = unstable_cache(
  async (uniqueName: string) => {
    return prisma.item.findUnique({
      where: { uniqueName },
    });
  },
  ["item-by-unique-name"],
  { revalidate: 3600, tags: ["items"] }
);

export const getModsForCategory = unstable_cache(
  async (compatName: string) => {
    return prisma.mod.findMany({
      where: { compatName },
      orderBy: { name: "asc" },
    });
  },
  ["mods-for-category"],
  { revalidate: 3600, tags: ["mods"] }
);
```

---

## 6. Build System

### 6.1 Build CRUD Operations

Create `src/lib/db/builds.ts`:

```typescript
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";
import { BuildVisibility } from "@prisma/client";

// Create a new build
export async function createBuild(data: {
  itemId: string;
  name: string;
  description?: string;
  visibility?: BuildVisibility;
  buildData: object;
  forkedFromId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const slug = `${nanoid(10)}`;

  return prisma.build.create({
    data: {
      slug,
      userId: session.user.id,
      itemId: data.itemId,
      name: data.name,
      description: data.description,
      visibility: data.visibility ?? "PUBLIC",
      buildData: data.buildData,
      forkedFromId: data.forkedFromId,
      hasShards: Boolean((data.buildData as any)?.shardSlots?.length),
    },
  });
}

// Update a build (owner only)
export async function updateBuild(
  buildId: string,
  data: Partial<{
    name: string;
    description: string;
    visibility: BuildVisibility;
    buildData: object;
  }>
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: { userId: true },
  });

  if (!build) throw new Error("Build not found");
  if (build.userId !== session.user.id) throw new Error("Not authorized");

  return prisma.build.update({
    where: { id: buildId },
    data: {
      ...data,
      hasShards: data.buildData
        ? Boolean((data.buildData as any)?.shardSlots?.length)
        : undefined,
    },
  });
}

// Get build by slug (respects visibility)
export async function getBuildBySlug(slug: string) {
  const session = await auth();
  const build = await prisma.build.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
      item: { select: { uniqueName: true, name: true, browseCategory: true } },
      linkedTo: {
        include: {
          toBuild: {
            select: { id: true, slug: true, name: true, buildData: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      buildGuide: true,
    },
  });

  if (!build) return null;

  // Check visibility
  if (build.visibility === "PRIVATE") {
    if (!session?.user?.id || build.userId !== session.user.id) {
      return null;
    }
  }
  // UNLISTED builds are accessible via direct link
  // PUBLIC builds are accessible to everyone

  return build;
}

// List builds with filters
export async function listBuilds(options: {
  itemId?: string;
  userId?: string;
  visibility?: BuildVisibility;
  page?: number;
  limit?: number;
  orderBy?: "recent" | "popular";
}) {
  const session = await auth();
  const { page = 1, limit = 20, orderBy = "recent" } = options;

  const where: any = {};

  // Filter by item
  if (options.itemId) {
    where.itemId = options.itemId;
  }

  // Filter by user
  if (options.userId) {
    where.userId = options.userId;
  }

  // Visibility logic
  if (options.visibility) {
    where.visibility = options.visibility;
  } else {
    // Default: show public, or own builds
    where.OR = [
      { visibility: "PUBLIC" },
      ...(session?.user?.id ? [{ userId: session.user.id }] : []),
    ];
  }

  const [builds, total] = await Promise.all([
    prisma.build.findMany({
      where,
      include: {
        user: { select: { name: true, username: true, image: true } },
        item: { select: { name: true, imageName: true, browseCategory: true } },
      },
      orderBy: orderBy === "popular"
        ? { voteCount: "desc" }
        : { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.build.count({ where }),
  ]);

  return { builds, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Fork a build
export async function forkBuild(buildId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const original = await prisma.build.findUnique({
    where: { id: buildId },
    include: { item: true },
  });

  if (!original) throw new Error("Build not found");
  if (original.visibility === "PRIVATE" && original.userId !== session.user.id) {
    throw new Error("Cannot fork private build");
  }

  return createBuild({
    itemId: original.itemId,
    name: `${original.name} (Fork)`,
    description: original.description ?? undefined,
    buildData: original.buildData as object,
    forkedFromId: original.id,
  });
}
```

### 6.2 Build Links

```typescript
// Link builds together
export async function linkBuilds(fromBuildId: string, toBuildId: string, label?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Verify ownership of fromBuild
  const fromBuild = await prisma.build.findUnique({
    where: { id: fromBuildId },
    select: { userId: true },
  });

  if (!fromBuild || fromBuild.userId !== session.user.id) {
    throw new Error("Not authorized");
  }

  return prisma.buildLink.create({
    data: {
      fromBuildId,
      toBuildId,
      label,
    },
  });
}

// Remove link
export async function unlinkBuilds(fromBuildId: string, toBuildId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const fromBuild = await prisma.build.findUnique({
    where: { id: fromBuildId },
    select: { userId: true },
  });

  if (!fromBuild || fromBuild.userId !== session.user.id) {
    throw new Error("Not authorized");
  }

  return prisma.buildLink.delete({
    where: {
      fromBuildId_toBuildId: { fromBuildId, toBuildId },
    },
  });
}
```

---

## 7. Social Features

### 7.1 Voting with Rate Limiting

Create `src/lib/rate-limit.ts`:

```typescript
import { LRUCache } from "lru-cache";

type RateLimitOptions = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

export function rateLimit(options?: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  });

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, [1]);
        }
        tokenCount[0] += 1;

        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage >= limit;

        if (isRateLimited) {
          reject(new Error("Rate limit exceeded"));
        } else {
          tokenCache.set(token, tokenCount);
          resolve();
        }
      }),
  };
}
```

Create `src/lib/db/votes.ts`:

```typescript
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const voteLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

// Toggle vote (upvote or remove)
export async function toggleVote(buildId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Rate limit: 10 votes per minute per user
  await voteLimiter.check(10, `vote_${session.user.id}`);

  const existingVote = await prisma.buildVote.findUnique({
    where: {
      userId_buildId: {
        userId: session.user.id,
        buildId,
      },
    },
  });

  if (existingVote) {
    // Remove vote
    await prisma.$transaction([
      prisma.buildVote.delete({
        where: { id: existingVote.id },
      }),
      prisma.build.update({
        where: { id: buildId },
        data: { voteCount: { decrement: 1 } },
      }),
    ]);
    return { voted: false };
  } else {
    // Add vote
    await prisma.$transaction([
      prisma.buildVote.create({
        data: {
          userId: session.user.id,
          buildId,
        },
      }),
      prisma.build.update({
        where: { id: buildId },
        data: { voteCount: { increment: 1 } },
      }),
    ]);
    return { voted: true };
  }
}

// Check if user has voted
export async function hasUserVoted(buildId: string) {
  const session = await auth();
  if (!session?.user?.id) return false;

  const vote = await prisma.buildVote.findUnique({
    where: {
      userId_buildId: {
        userId: session.user.id,
        buildId,
      },
    },
  });

  return Boolean(vote);
}
```

### 7.2 Favorites

Create `src/lib/db/favorites.ts`:

```typescript
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function toggleFavorite(buildId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const existingFavorite = await prisma.buildFavorite.findUnique({
    where: {
      userId_buildId: {
        userId: session.user.id,
        buildId,
      },
    },
  });

  if (existingFavorite) {
    await prisma.$transaction([
      prisma.buildFavorite.delete({
        where: { id: existingFavorite.id },
      }),
      prisma.build.update({
        where: { id: buildId },
        data: { favoriteCount: { decrement: 1 } },
      }),
    ]);
    return { favorited: false };
  } else {
    await prisma.$transaction([
      prisma.buildFavorite.create({
        data: {
          userId: session.user.id,
          buildId,
        },
      }),
      prisma.build.update({
        where: { id: buildId },
        data: { favoriteCount: { increment: 1 } },
      }),
    ]);
    return { favorited: true };
  }
}

export async function getUserFavorites(userId: string, page = 1, limit = 20) {
  return prisma.buildFavorite.findMany({
    where: { userId },
    include: {
      build: {
        include: {
          item: { select: { name: true, imageName: true, browseCategory: true } },
          user: { select: { name: true, username: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
}
```

---

## 8. Guides System

### 8.1 Guide Types

There are two types of guides:

1. **Build Guides**: Rich text attached to a specific build (stored in `BuildGuide` table)
2. **General Guides**: Standalone guides about game mechanics, strategies, etc. (stored in `Guide` table)

Both can embed builds for display.

### 8.2 Guide CRUD

Create `src/lib/db/guides.ts`:

```typescript
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import slugify from "slugify";

export async function createGuide(data: {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  content: object; // Lexical SerializedEditorState
  coverImage?: string;
  status?: "draft" | "published";
  embedBuildIds?: string[];
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const baseSlug = slugify(data.title, { lower: true, strict: true });
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const guide = await prisma.guide.create({
    data: {
      slug,
      userId: session.user.id,
      title: data.title,
      summary: data.summary,
      category: data.category,
      tags: data.tags,
      content: data.content,
      coverImage: data.coverImage,
      status: data.status ?? "draft",
      readingTime: calculateReadingTime(data.content),
    },
  });

  // Add build embeds
  if (data.embedBuildIds?.length) {
    await prisma.guideEmbed.createMany({
      data: data.embedBuildIds.map((buildId, index) => ({
        guideId: guide.id,
        buildId,
        sortOrder: index,
      })),
    });
  }

  return guide;
}

// Embed a build in a guide
export async function embedBuildInGuide(guideId: string, buildId: string, label?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const guide = await prisma.guide.findUnique({
    where: { id: guideId },
    select: { userId: true },
  });

  if (!guide || guide.userId !== session.user.id) {
    throw new Error("Not authorized");
  }

  return prisma.guideEmbed.create({
    data: { guideId, buildId, label },
  });
}

function calculateReadingTime(content: object): number {
  // Implement based on your Lexical content structure
  // Rough estimate: count words, divide by 200
  const text = JSON.stringify(content);
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}
```

### 8.3 Build Guide (per-build)

```typescript
export async function saveBuildGuide(buildId: string, content: object) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: { userId: true },
  });

  if (!build || build.userId !== session.user.id) {
    throw new Error("Not authorized");
  }

  return prisma.buildGuide.upsert({
    where: { buildId },
    create: { buildId, content },
    update: { content },
  });
}

export async function getBuildGuide(buildId: string) {
  return prisma.buildGuide.findUnique({
    where: { buildId },
  });
}
```

---

## 9. Image Generation API

### 9.1 Overview

Restricted API for generating build images. Uses Puppeteer to render a build component to PNG/JPG.

### 9.2 API Key Management

Create `src/lib/db/api-keys.ts`:

```typescript
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { randomBytes, createHash } from "crypto";

// Generate a new API key (admin only)
export async function createApiKey(data: {
  name: string;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: Date;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // TODO: Add admin check
  // if (!session.user.isAdmin) throw new Error("Not authorized");

  const rawKey = `ask_${randomBytes(32).toString("hex")}`;
  const hashedKey = createHash("sha256").update(rawKey).digest("hex");

  await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name: data.name,
      key: hashedKey,
      keyPrefix: rawKey.slice(0, 12),
      scopes: data.scopes,
      rateLimit: data.rateLimit ?? 100,
      expiresAt: data.expiresAt,
    },
  });

  // Return the raw key only once - it can't be retrieved later
  return { key: rawKey };
}

// Validate an API key
export async function validateApiKey(rawKey: string) {
  const hashedKey = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { key: hashedKey },
  });

  if (!apiKey) return null;
  if (!apiKey.isActive) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}
```

### 9.3 Image Generation Endpoint

Create `src/app/api/v1/builds/[slug]/image/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/db/api-keys";
import { getBuildBySlug } from "@/lib/db/builds";
import { generateBuildImage } from "@/lib/image-gen";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  // Validate API key
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const apiKey = await validateApiKey(authHeader.slice(7));
  if (!apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  if (!apiKey.scopes.includes("image:generate")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Get build
  const build = await getBuildBySlug(params.slug);
  if (!build) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }

  // Parse options from query params
  const searchParams = request.nextUrl.searchParams;
  const options = {
    template: searchParams.get("template") ?? "full",
    showStats: searchParams.get("stats") !== "false",
    showShards: searchParams.get("shards") !== "false",
    showArcanes: searchParams.get("arcanes") !== "false",
    format: (searchParams.get("format") ?? "png") as "png" | "jpg",
    width: parseInt(searchParams.get("width") ?? "800"),
  };

  // Generate image
  const imageBuffer = await generateBuildImage(build, options);

  // Return image or URL based on query param
  if (searchParams.get("return") === "url") {
    // Upload to R2/Blob and return URL
    const url = await uploadImage(imageBuffer, build.slug, options);
    return NextResponse.json({ url });
  }

  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": `image/${options.format}`,
      "Content-Disposition": `attachment; filename="${build.slug}.${options.format}"`,
    },
  });
}
```

### 9.4 Image Generation with Puppeteer

Create `src/lib/image-gen/index.ts`:

```typescript
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

interface GenerateOptions {
  template: "full" | "compact" | "mods-only";
  showStats: boolean;
  showShards: boolean;
  showArcanes: boolean;
  format: "png" | "jpg";
  width: number;
}

export async function generateBuildImage(
  build: any,
  options: GenerateOptions
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({
      width: options.width,
      height: 600, // Will be adjusted based on content
      deviceScaleFactor: 2, // Retina quality
    });

    // Navigate to internal render endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const renderUrl = new URL(`/render/build/${build.slug}`, baseUrl);
    renderUrl.searchParams.set("template", options.template);
    renderUrl.searchParams.set("stats", String(options.showStats));
    renderUrl.searchParams.set("shards", String(options.showShards));
    renderUrl.searchParams.set("arcanes", String(options.showArcanes));

    await page.goto(renderUrl.toString(), { waitUntil: "networkidle0" });

    // Wait for content to render
    await page.waitForSelector("#build-render-target");

    // Get element bounds
    const element = await page.$("#build-render-target");
    const boundingBox = await element?.boundingBox();

    // Screenshot
    const screenshot = await page.screenshot({
      type: options.format === "jpg" ? "jpeg" : "png",
      clip: boundingBox ?? undefined,
      omitBackground: options.format === "png",
    });

    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}
```

### 9.5 Internal Render Page

Create `src/app/render/build/[slug]/page.tsx`:

```typescript
// This page is only for Puppeteer to render - not for public access
import { getBuildBySlug } from "@/lib/db/builds";
import { BuildRenderView } from "@/components/build-render/build-render-view";

export default async function BuildRenderPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { template?: string; stats?: string; shards?: string; arcanes?: string };
}) {
  const build = await getBuildBySlug(params.slug);
  if (!build) return null;

  return (
    <div id="build-render-target" className="inline-block bg-background p-4">
      <BuildRenderView
        build={build}
        template={searchParams.template ?? "full"}
        showStats={searchParams.stats !== "false"}
        showShards={searchParams.shards !== "false"}
        showArcanes={searchParams.arcanes !== "false"}
      />
    </div>
  );
}
```

---

## 10. Caching Strategy

### 10.1 Overview

| Data               | Strategy                            | TTL    | Invalidation            |
| ------------------ | ----------------------------------- | ------ | ----------------------- |
| Items/Mods/Arcanes | `unstable_cache` + ISR              | 1 hour | On WFCD sync            |
| Build lists        | `unstable_cache`                    | 5 min  | On create/update/delete |
| Individual build   | No cache (user-specific visibility) | -      | -                       |
| Generated images   | R2/Blob with TTL                    | 7 days | On build update         |

### 10.2 Cache Tags

Use Next.js cache tags for surgical invalidation:

```typescript
import { revalidateTag } from "next/cache";

// After WFCD sync
revalidateTag("items");
revalidateTag("mods");
revalidateTag("arcanes");

// After build update
revalidateTag(`build-${buildId}`);
revalidateTag(`builds-item-${itemId}`);
revalidateTag(`builds-user-${userId}`);
```

### 10.3 Rate Limiting Summary

| Action           | Limit              | Window     |
| ---------------- | ------------------ | ---------- |
| Votes            | 10                 | per minute |
| Favorites        | 20                 | per minute |
| Build create     | 10                 | per hour   |
| Build update     | 30                 | per hour   |
| Sign-in (email)  | 5                  | per hour   |
| Image generation | Per API key config | per hour   |
| Manual WFCD sync | 1                  | per hour   |

### 10.4 Search & Discovery

- Postgres `pg_trgm` trigram indexes on `Item.name`, `Item.browseCategory`, `Build.name`, `Build.description` for fuzzy search; fall back to prefix search if `pg_trgm` is unavailable on Neon.
- Filters for browse pages: item category, mastery requirement, polarity (mods), shards flag, visibility, vote/favorite counts, owner username.
- Add lightweight search API/server action returning IDs + highlight snippets; paginate to avoid full scans.
- Rebuild search indexes after WFCD sync and major build migrations.

### 10.5 Error Response Format

Standardize all API error responses for consistency:

```typescript
// src/lib/api-error.ts

export interface ApiError {
  error: string;        // Human-readable message
  code?: string;        // Machine-readable error code
  details?: object;     // Additional context (validation errors, etc.)
}

export class ApiException extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    public code?: string,
    public details?: object
  ) {
    super(error);
  }

  toResponse() {
    return Response.json(
      {
        error: this.error,
        ...(this.code && { code: this.code }),
        ...(this.details && { details: this.details }),
      },
      { status: this.statusCode }
    );
  }
}

// Common errors
export const Errors = {
  UNAUTHORIZED: new ApiException(401, "Authentication required", "UNAUTHORIZED"),
  FORBIDDEN: new ApiException(403, "Permission denied", "FORBIDDEN"),
  NOT_FOUND: (resource: string) => new ApiException(404, `${resource} not found`, "NOT_FOUND"),
  RATE_LIMITED: new ApiException(429, "Rate limit exceeded", "RATE_LIMITED"),
  VALIDATION: (details: object) => new ApiException(400, "Validation error", "VALIDATION_ERROR", details),
  INTERNAL: new ApiException(500, "Internal server error", "INTERNAL_ERROR"),
};
```

Usage in API routes:

```typescript
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Errors.UNAUTHORIZED.toResponse();
    }

    const body = await request.json();
    const validation = validateBuildInput(body);
    if (!validation.success) {
      return Errors.VALIDATION(validation.errors).toResponse();
    }

    const build = await createBuild(body);
    return Response.json(build, { status: 201 });

  } catch (error) {
    if (error instanceof ApiException) {
      return error.toResponse();
    }
    console.error("Unhandled error:", error);
    return Errors.INTERNAL.toResponse();
  }
}
```

Error codes for reference:

| Code               | HTTP Status | Description                                        |
| ------------------ | ----------- | -------------------------------------------------- |
| `UNAUTHORIZED`     | 401         | Missing or invalid authentication                  |
| `FORBIDDEN`        | 403         | Authenticated but not allowed                      |
| `NOT_FOUND`        | 404         | Resource doesn't exist                             |
| `VALIDATION_ERROR` | 400         | Request body validation failed                     |
| `RATE_LIMITED`     | 429         | Too many requests                                  |
| `CONFLICT`         | 409         | Resource already exists (e.g., duplicate username) |
| `INTERNAL_ERROR`   | 500         | Unexpected server error                            |

---

## 11. Migration Plan

### 11.1 Overview

Migrate from current state (static JSON, localStorage) to database-backed system.

### 11.2 Steps

#### Phase 1: Database Setup (No Breaking Changes)

1. Add Docker Compose for local Postgres
2. Add Prisma with schema
3. Run initial migration
4. Add WFCD sync script
5. Seed database from current JSON files
6. Add data access layer that reads from DB
7. **Keep old code paths working** - feature flag to switch between static/DB

```typescript
// Feature flag during migration
const USE_DATABASE = process.env.USE_DATABASE === "true";

export async function getItems(category: string) {
  if (USE_DATABASE) {
    return getItemsFromDb(category);
  }
  return getItemsFromJson(category);
}
```

#### Phase 2: Auth

1. Add NextAuth configuration
2. Create auth pages (sign in, verify, error)
3. Add session provider to layout
4. Add sign in/out UI components
5. Test auth flow end-to-end

#### Phase 3: Build Persistence

1. Add build CRUD endpoints/server actions
2. Update BuildContainer to save to DB when authenticated
3. Keep localStorage as fallback for unauthenticated users
4. Add "Save to account" prompt for localStorage builds when user signs in
5. Add build visibility controls
6. Add build sharing (slug-based URLs)

#### Phase 4: Social Features

1. Add vote/favorite endpoints
2. Add UI for voting/favoriting
3. Add user profile page with their builds/favorites
4. Add build counts to item pages

#### Phase 5: Advanced Features

1. Build linking
2. Build forking
3. Guides system migration
4. Image generation API

### 11.3 localStorage Migration

When a user signs in with existing localStorage builds:

```typescript
async function migrateLocalBuilds(userId: string) {
  const localBuilds = getAllLocalStorageBuilds();

  for (const build of localBuilds) {
    // Check if already migrated
    const existing = await prisma.build.findFirst({
      where: {
        userId,
        buildData: { path: ["itemUniqueName"], equals: build.itemUniqueName },
      },
    });

    if (!existing) {
      await createBuild({
        itemId: await getItemIdByUniqueName(build.itemUniqueName),
        name: build.buildName ?? `${build.itemName} Build`,
        buildData: build,
      });
    }
  }

  // Optionally clear localStorage after successful migration
}
```

---

## 12. Environment Variables

### 12.1 Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/arsenix"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"  # Or production URL
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# GitHub OAuth
GITHUB_ID="your-github-app-id"
GITHUB_SECRET="your-github-app-secret"

# Email (for magic links)
EMAIL_SERVER_HOST="smtp.example.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email"
EMAIL_SERVER_PASSWORD="your-password"
EMAIL_FROM="noreply@arsenix.app"
```

### 12.2 Optional Variables

```bash
# Vercel Cron (for WFCD sync)
CRON_SECRET="your-cron-secret"

# Image storage
R2_ACCOUNT_ID="your-r2-account"
R2_ACCESS_KEY_ID="your-r2-key"
R2_SECRET_ACCESS_KEY="your-r2-secret"
R2_BUCKET_NAME="arsenix-images"

# Or Vercel Blob
BLOB_READ_WRITE_TOKEN="your-blob-token"

# Rate limiting with Upstash (optional, can use in-memory)
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Feature flags
USE_DATABASE="true"

# App URL (for image generation)
NEXT_PUBLIC_APP_URL="https://arsenix.app"
```

### 12.3 Development vs Production

| Variable       | Development                                | Production             |
| -------------- | ------------------------------------------ | ---------------------- |
| `DATABASE_URL` | Docker local                               | Neon connection string |
| `NEXTAUTH_URL` | `http://localhost:3000`                    | `https://arsenix.app`  |
| `USE_DATABASE` | `false` initially, then `true`             | `true`                 |
| Preview envs   | Neon branch per PR (unique `DATABASE_URL`) | -                      |

---

## 13. Implementation Order

### Sprint 1: Foundation (Database + Auth)

1. [x] Set up Docker Compose for local Postgres
2. [x] Initialize Prisma with schema
3. [x] Run migrations, verify schema
4. [x] Write WFCD sync script
5. [x] Seed database with current data
6. [x] Add data access layer with feature flag
7. [x] Set up NextAuth with GitHub provider
8. [x] Create auth pages
9. [x] Add session provider and auth UI

### Sprint 2: Build Persistence

1. [x] Create build CRUD server actions
2. [x] Update BuildContainer to persist to DB
3. [x] Add localStorage fallback for guests
4. [x] Implement build visibility (public/private/unlisted) - API ready, needs UI selector
5. [x] Add slug-based build URLs
6. [x] Create build browse/list pages

### Sprint 3: Social Features

1. [ ] Implement voting with rate limiting
2. [ ] Implement favorites
3. [ ] Add vote/favorite UI to build pages
4. [ ] Create user profile page
5. [ ] Add "My Builds" and "My Favorites" pages
6. [ ] Add build counts to item pages

### Sprint 4: Advanced Features

1. [ ] Implement build forking
2. [ ] Implement build linking
3. [ ] Migrate guides to database
4. [ ] Add build embedding in guides
5. [ ] Add Archon shards to BuildState and UI

### Sprint 5: Image Generation

1. [ ] Set up API key management
2. [ ] Create admin UI for API keys
3. [ ] Implement Puppeteer image generation
4. [ ] Create internal render pages
5. [ ] Set up image caching/storage
6. [ ] Test with PT community

### Ongoing

- [ ] Monitor Neon usage, upgrade if needed
- [ ] Nightly DB backup/branch snapshot (verify restore quarterly)
- [ ] Set up WFCD sync cron job
- [ ] Add error monitoring (Sentry)
- [ ] Add cron heartbeat/alerting for WFCD sync and image cleanup
- [ ] Performance optimization as needed
- [ ] Weekly cleanup job for expired generated images

---

## Appendix A: File Structure

```
arsenix/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── scripts/
│   └── sync-wfcd-to-db.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── cron/sync-wfcd/route.ts
│   │   │   └── v1/builds/[slug]/image/route.ts
│   │   ├── auth/
│   │   │   ├── signin/page.tsx
│   │   │   ├── verify/page.tsx
│   │   │   └── error/page.tsx
│   │   ├── render/build/[slug]/page.tsx
│   │   ├── builds/
│   │   │   ├── page.tsx (browse builds)
│   │   │   └── [slug]/page.tsx (view build)
│   │   ├── profile/
│   │   │   └── [username]/page.tsx
│   │   └── ...existing pages
│   ├── lib/
│   │   ├── db.ts (Prisma client)
│   │   ├── auth.ts (NextAuth config)
│   │   ├── rate-limit.ts
│   │   ├── db/
│   │   │   ├── items.ts
│   │   │   ├── mods.ts
│   │   │   ├── builds.ts
│   │   │   ├── votes.ts
│   │   │   ├── favorites.ts
│   │   │   ├── guides.ts
│   │   │   └── api-keys.ts
│   │   ├── wfcd/
│   │   │   └── sync.ts
│   │   └── image-gen/
│   │       └── index.ts
│   └── components/
│       ├── auth/
│       │   ├── sign-in-button.tsx
│       │   └── user-menu.tsx
│       ├── build-render/
│       │   └── build-render-view.tsx
│       └── ...existing components
├── docker-compose.yml
└── ...existing files
```

---

## Appendix B: Glossary

| Term           | Definition                                                             |
| -------------- | ---------------------------------------------------------------------- |
| **WFCD**       | Warframe Community Developers - source of item/mod data                |
| **Build**      | A saved configuration of mods, arcanes, and shards for a Warframe item |
| **BuildGuide** | Rich text explanation attached to a specific build                     |
| **Guide**      | Standalone guide about game mechanics (not build-specific)             |
| **Shard**      | Archon Shard - permanent upgrade for Warframes                         |
| **Forma**      | Polarity change applied to a mod slot                                  |
| **Visibility** | PUBLIC (browseable), PRIVATE (owner only), UNLISTED (link only)        |

---

## Appendix C: Testing Strategy

### C.1 Testing Stack

```bash
# Testing dependencies
bun add -D vitest @testing-library/react @testing-library/user-event
bun add -D @playwright/test
bun add -D prisma-test-utils  # Or use Prisma's built-in test utilities
```

### C.2 Test Categories

| Category          | Tool                     | Purpose                                         |
| ----------------- | ------------------------ | ----------------------------------------------- |
| Unit tests        | Vitest                   | Pure functions, utilities, data transformations |
| Integration tests | Vitest + Prisma          | Database operations, server actions             |
| Component tests   | Vitest + Testing Library | React components in isolation                   |
| E2E tests         | Playwright               | Full user flows                                 |

### C.3 What to Test

**Unit Tests (fast, run frequently)**

- `src/lib/warframe/capacity.ts` - Drain calculations, forma counting
- `src/lib/rate-limit.ts` - Rate limiting logic
- `src/lib/api-error.ts` - Error formatting
- Build data validation/transformation
- Slug generation

```typescript
// Example: capacity.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDrain, calculateFormaCount } from './capacity';

describe('calculateDrain', () => {
  it('halves drain for matching polarity', () => {
    expect(calculateDrain(10, 'madurai', 'madurai')).toBe(5);
  });

  it('increases drain for mismatched polarity', () => {
    expect(calculateDrain(10, 'madurai', 'vazarin')).toBe(13); // ceil(10 * 1.25)
  });
});
```

**Integration Tests (slower, test DB interactions)**

- WFCD sync script - verify upserts work correctly
- Build CRUD - create, read, update, delete with ownership checks
- Vote/favorite toggling - verify count updates
- Visibility rules - private/public/unlisted access

```typescript
// Example: builds.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { createBuild, getBuildBySlug } from '@/lib/db/builds';

describe('Build operations', () => {
  beforeEach(async () => {
    await prisma.build.deleteMany();
    await prisma.user.deleteMany();
    // Seed test user
  });

  it('creates build with correct slug', async () => {
    const build = await createBuild({
      itemId: 'test-item-id',
      name: 'Test Build',
      buildData: { /* ... */ },
    });

    expect(build.slug).toMatch(/^[a-zA-Z0-9_-]{10}$/);
  });

  it('respects visibility rules', async () => {
    // Create private build as user A
    // Try to fetch as user B - should return null
  });
});
```

**E2E Tests (slowest, run before deploy)**

- Auth flow: sign in with email magic link
- Auth flow: sign in with GitHub
- Create build: select item → add mods → save → view
- Vote on build: click vote → verify count updates
- Fork build: view public build → fork → verify new build
- Image generation: API key → request image → verify response

```typescript
// Example: auth.e2e.test.ts
import { test, expect } from '@playwright/test';

test('can sign in with GitHub', async ({ page }) => {
  await page.goto('/auth/signin');
  await page.click('button:has-text("Sign in with GitHub")');
  // ... handle GitHub OAuth flow (may need mocking)
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
});

test('can create and save a build', async ({ page }) => {
  // Sign in first
  await page.goto('/browse/warframes');
  await page.click('text=Trinity');
  await page.click('button:has-text("Create Build")');

  // Add a mod
  await page.click('[data-slot="normal-0"]');
  await page.fill('[placeholder="Search mods"]', 'Vitality');
  await page.click('text=Vitality');

  // Save
  await page.click('button:has-text("Save")');
  await expect(page.locator('text=Build saved')).toBeVisible();
});
```

### C.4 Test Database

Use a separate test database to avoid polluting development data:

```bash
# .env.test
DATABASE_URL="postgresql://arsenix:arsenix_dev@localhost:5432/arsenix_test"
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST,
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
```

```typescript
// tests/setup.ts
import { prisma } from '@/lib/db';
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Run migrations on test DB
  // Optionally seed with minimal test data
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### C.5 CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: arsenix
          POSTGRES_PASSWORD: arsenix_test
          POSTGRES_DB: arsenix_test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - run: bun install
      - run: bun prisma migrate deploy
        env:
          DATABASE_URL: postgresql://arsenix:arsenix_test@localhost:5432/arsenix_test

      - run: bun test
        env:
          DATABASE_URL: postgresql://arsenix:arsenix_test@localhost:5432/arsenix_test

      - run: bun playwright install --with-deps
      - run: bun playwright test
        env:
          DATABASE_URL: postgresql://arsenix:arsenix_test@localhost:5432/arsenix_test
```

### C.6 Test Coverage Goals

| Area              | Target         | Notes                            |
| ----------------- | -------------- | -------------------------------- |
| Utility functions | 90%+           | Pure functions, easy to test     |
| DB operations     | 80%+           | Focus on edge cases, auth checks |
| API routes        | 70%+           | Test error handling, validation  |
| Components        | 50%+           | Focus on interactive components  |
| E2E               | Critical paths | Auth, build CRUD, voting         |

Don't aim for 100% coverage - focus on:
1. Business logic (capacity calculations, sync logic)
2. Authorization (ownership checks, visibility rules)
3. Data integrity (vote counts, cascade deletes)
4. User-facing flows (E2E for critical paths)
