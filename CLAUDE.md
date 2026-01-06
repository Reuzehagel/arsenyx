# CLAUDE.md - AI Assistant Guide for Arsenyx

## Project Overview

Arsenyx is a Warframe build planner - a web application for creating, sharing, and discovering equipment builds for the game Warframe. It features keyboard-first navigation, rich text guides, mod/arcane management, and social features (voting, favorites, forking builds).

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Server Components by default)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (New York theme)
- **Database**: PostgreSQL via Prisma ORM with `@prisma/adapter-pg`
- **Authentication**: Better Auth with GitHub OAuth
- **Rich Text Editor**: Lexical
- **Package Manager**: Bun (required)
- **Data Source**: `@wfcd/items` (Warframe Community Data)

## Quick Commands

```bash
bun install          # Install dependencies (runs prisma generate)
bun dev              # Start dev server (Next.js with Turbopack)
bun build            # Production build
bun lint             # Run ESLint

# Database
bun run db:push      # Push schema to database
bun run db:migrate   # Run migrations
bun run db:studio    # Open Prisma Studio

# Warframe Data Sync
bun run sync-data    # Copy WFCD JSON files to src/data/warframe/
bun run update-data  # Update @wfcd/items package + sync
bun run db:sync      # Sync WFCD data to PostgreSQL database
```

## Project Structure

```txt
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (auth)
│   ├── browse/            # Item browsing (warframes, weapons, etc.)
│   ├── builds/            # Build viewing and management
│   ├── guides/            # User guides
│   └── ...
├── components/
│   ├── ui/                # shadcn/ui primitives (DO NOT modify unless necessary)
│   ├── browse/            # Browse page components
│   ├── build/             # Build display components
│   ├── build-editor/      # Build creation/editing
│   ├── editor/            # Lexical rich text editor
│   ├── mod-card/          # Mod card rendering
│   ├── arcane-card/       # Arcane card rendering
│   ├── auth/              # Authentication components
│   ├── guides/            # Guide components
│   └── landing/           # Homepage components
├── lib/
│   ├── warframe/          # Warframe domain utilities
│   │   ├── items.ts       # SERVER-ONLY: JSON data loading
│   │   ├── data.ts        # SERVER-ONLY: Unified data API
│   │   ├── index.ts       # Client-safe exports
│   │   ├── types.ts       # All TypeScript types
│   │   ├── images.ts      # getImageUrl() helper
│   │   ├── categories.ts  # Category definitions
│   │   └── ...
│   ├── db/                # Database query functions
│   │   ├── builds.ts      # Build CRUD operations
│   │   ├── items.ts       # Item queries
│   │   ├── mods.ts        # Mod queries
│   │   └── ...
│   ├── auth.ts            # Better Auth server config
│   ├── auth-client.ts     # Better Auth client
│   ├── db.ts              # Prisma client singleton
│   └── utils.ts           # cn() utility
├── data/
│   └── warframe/          # Static JSON from @wfcd/items
prisma/
└── schema.prisma          # Database schema
scripts/
├── sync-warframe-data.ts  # Copy JSON from node_modules
└── sync-wfcd-to-db.ts     # Sync WFCD data to database
```

## Key Patterns

### Server vs Client Components

```typescript
// SERVER Component (default) - can use database, fs, etc.
import { getItemsByCategory } from "@/lib/warframe/items";
import { prisma } from "@/lib/db";

// CLIENT Component - must use "use client" directive
"use client";
import { getImageUrl, type BrowseItem } from "@/lib/warframe";
// Never import from "@/lib/warframe/items" or "@/lib/db" in client components
```

### Import Path Aliases

Always use the `@/` alias for imports:

```typescript
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BrowseItem } from "@/lib/warframe/types";
```

### Component Barrel Exports

Each component folder has an `index.ts` with named exports:

```typescript
// src/components/browse/index.ts
export { ItemCard } from "./item-card";
export { ItemGrid } from "./item-grid";
// ...

// Usage:
import { ItemCard, ItemGrid } from "@/components/browse";
```

### Styling Conventions

1. **Use `cn()` for class merging**:

   ```typescript
   import { cn } from "@/lib/utils";
   <div className={cn("base-class", isActive && "active-class")} />
   ```

2. **Override shadcn/ui defaults explicitly**:

   ```typescript
   <Card className="py-0 gap-0">  // Remove default padding/gap
   ```

3. **Consistent badge sizing**:

   ```typescript
   <Badge className="text-xs px-2 py-0.5">
   ```

4. **Images**: Use Next.js Image with `fill` + `object-cover` in `aspect-square` containers:

   ```typescript
   <div className="relative aspect-square">
     <Image src={url} alt={name} fill className="object-cover" unoptimized />
   </div>
   ```

### Warframe Image URLs

```typescript
import { getImageUrl } from "@/lib/warframe";

const imageUrl = getImageUrl(item.imageName);
// Returns CDN URL (cdn.warframestat.us) or placeholder SVG
```

### Database Access

```typescript
import { prisma } from "@/lib/db";

// Always use typed queries
const build = await prisma.build.findUnique({
  where: { slug },
  include: { user: true, item: true },
});
```

### Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name> -y
```

## Type Definitions

Key types in `@/lib/warframe/types.ts`:

- `BrowseCategory`: `"warframes" | "primary" | "secondary" | "melee" | ...`
- `BrowseItem`: Simplified item for grid display
- `Warframe`, `Gun`, `Melee`, `Companion`: Full item types
- `Mod`, `PlacedMod`: Mod types
- `Arcane`, `PlacedArcane`: Arcane types
- `BuildState`: Complete build configuration
- `Polarity`: `"madurai" | "vazarin" | "naramon" | ...`
- `ShardColor`, `PlacedShard`: Archon shard types

## Database Schema Overview

Main models in `prisma/schema.prisma`:

- **User**: Auth + profile, roles (USER, VERIFIED, DEVELOPER, MODERATOR, ADMIN)
- **Item**: Synced Warframe items (warframes, weapons, companions)
- **Mod**: All game mods with stats
- **Arcane**: All arcanes
- **Build**: User-created builds with mod/arcane configurations
- **BuildGuide**: Rich text (Lexical) attached to builds
- **Guide**: Standalone user guides
- **BuildVote/BuildFavorite**: Social features

## Environment Variables

Required in `.env`:

```txt
DATABASE_URL=postgresql://arsenyx:arsenyx_dev@localhost:5432/arsenyx
GITHUB_ID=...
GITHUB_SECRET=...
BETTER_AUTH_SECRET=...
USE_DATABASE=true  # Optional: use DB instead of static JSON
```

## Development Workflow

1. **Start database**: `docker compose up -d`
2. **Push schema**: `bun run db:push`
3. **Sync WFCD data**: `bun run db:sync` (if using database mode)
4. **Start dev server**: `bun dev`
5. **View at**: <http://localhost:3000>

## Important Notes

- **No tests currently** - be careful with refactoring
- **Keyboard-first UX** - preserve keyboard navigation in browse components
- **Server Components first** - only add `"use client"` when necessary
- **Don't modify `src/components/ui/`** unless absolutely required
- **Lexical editor** is complex - changes require understanding the plugin architecture
- **Images are from CDN** (cdn.warframestat.us) - don't try to serve locally
- **Prisma adapter-pg** is used for edge compatibility - keep pg as serverExternalPackages
