# CLAUDE.md - Arsenyx

## Project Overview

Arsenyx is a Warframe build planner — create, share, and discover equipment builds. Features keyboard-first navigation, rich text guides, mod/arcane management, and social features (voting, favorites, forking).

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Server Components by default)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (New York theme)
- **Database**: PostgreSQL via Prisma ORM with `@prisma/adapter-pg`
- **Authentication**: Better Auth with GitHub OAuth
- **Rich Text Editor**: Lexical
- **Linting**: Oxlint (replaces ESLint)
- **Formatting**: Oxfmt (with Tailwind class sorting)
- **Package Manager**: Bun (required)
- **Data Source**: `@wfcd/items` (Warframe Community Data)

## Commands

```bash
bun install              # Install deps (runs prisma generate via postinstall)
bun dev                  # Dev server (Next.js + Turbopack)
bun build                # Production build
bun lint                 # Oxlint
bun lint:fix             # Oxlint with auto-fix
bun fmt                  # Oxfmt (format src/)
bun fmt:check            # Oxfmt check mode
bun test                 # Run tests
bun test:watch           # Watch mode
bun test:coverage        # Coverage report

# Database
bun run db:push          # Push schema to database
bun run db:migrate       # Run migrations
bun run db:studio        # Open Prisma Studio

# Warframe Data
bun run sync-data        # Copy WFCD JSON files to src/data/warframe/
bun run update-data      # Update @wfcd/items package + sync
bun run db:sync          # Sync WFCD data to PostgreSQL database

# Overframe Import
bun run overframe:build-map  # Convert Overframe item mappings
```

## Development Workflow

1. `docker compose up -d` — start PostgreSQL
2. `bun run db:push` — push schema
3. `bun run db:sync` — sync WFCD data (if using database mode)
4. `bun dev` — start dev server at http://localhost:3000

## Project Structure

```txt
src/
├── app/
│   ├── actions/            # Server actions (builds, social)
│   ├── api/                # API routes (auth)
│   ├── auth/               # Auth pages (signin, error)
│   ├── browse/             # Item browsing (warframes, weapons, etc.)
│   ├── builds/             # Build viewing and management
│   ├── create/             # Build creation
│   ├── favorites/          # User favorites
│   ├── guides/             # User guides
│   ├── import/             # Overframe build import
│   ├── profile/[username]/ # User profiles
│   ├── about/ privacy/ terms/  # Static pages
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui primitives (DO NOT modify)
│   ├── arcane-card/        # Arcane card rendering
│   ├── auth/               # Authentication components
│   ├── browse/             # Browse page components
│   ├── build/              # Build display components
│   ├── build-editor/       # Build creation/editing
│   ├── guides/             # Guide components
│   ├── landing/            # Homepage components
│   ├── mod-card/           # Mod card rendering
│   ├── header.tsx          # Site header
│   ├── footer.tsx          # Site footer
│   ├── mobile-nav.tsx      # Mobile navigation
│   ├── search-command.tsx  # Global search (⌘K)
│   ├── icons.tsx           # Custom icons
│   └── theme-*.tsx         # Theme provider + toggle
├── lib/
│   ├── warframe/           # Warframe domain logic
│   │   ├── items.ts        # SERVER-ONLY: JSON data loading
│   │   ├── index.ts        # Client-safe re-exports
│   │   ├── types.ts        # All Warframe TypeScript types
│   │   ├── images.ts       # getImageUrl() helper
│   │   ├── categories.ts   # Category definitions
│   │   ├── mods.ts         # Mod utilities
│   │   ├── capacity.ts     # Mod capacity calculations
│   │   ├── schemas.ts      # Zod schemas
│   │   ├── stats/          # Stat engine (warframe, weapon stats)
│   │   ├── stat-parser.ts  # Stat string parsing
│   │   ├── helminth.ts     # Helminth ability data
│   │   ├── shards.ts       # Archon shard data
│   │   └── ...             # formatting, slugs, aura-effects, etc.
│   ├── db/                 # Database query functions
│   │   ├── builds.ts       # Build CRUD
│   │   ├── items.ts        # Item queries
│   │   ├── mods.ts         # Mod queries
│   │   ├── users.ts        # User queries
│   │   ├── votes.ts        # Vote queries
│   │   ├── favorites.ts    # Favorite queries
│   │   └── index.ts        # Barrel exports
│   ├── image/              # Satori image generation (build cards)
│   ├── guides/             # Guide data + types
│   ├── overframe/          # Overframe import/decode logic
│   ├── auth.ts             # Better Auth server config
│   ├── auth-client.ts      # Better Auth client
│   ├── build-codec.ts      # Build URL encoding/decoding
│   ├── constants.ts        # App constants
│   ├── db.ts               # Prisma client singleton
│   ├── rate-limit.ts       # Rate limiting
│   ├── result.ts           # Result type utility
│   ├── types.ts            # Shared app types
│   └── utils.ts            # cn() utility
├── data/
│   └── warframe/           # Static JSON from @wfcd/items
prisma/
└── schema.prisma           # Database schema
scripts/
├── sync-warframe-data.ts   # Copy JSON from node_modules
├── sync-wfcd-to-db.ts      # Sync WFCD data to database
└── convert-overframe-items.ts  # Overframe item mapping
```

## Key Patterns

### Server vs Client Boundary

```typescript
// SERVER (default) - can use database, fs, JSON loading
import { getItemsByCategory } from "@/lib/warframe/items";
import { prisma } from "@/lib/db";

// CLIENT - must have "use client" directive
"use client";
import { getImageUrl, type BrowseItem } from "@/lib/warframe";
// NEVER import from "@/lib/warframe/items" or "@/lib/db" in client components
```

### Component Barrel Exports

Each component folder has an `index.ts` with named exports. Import from the folder, not individual files:

```typescript
import { ItemCard, ItemGrid } from "@/components/browse";
```

### Images

- CDN: `cdn.warframestat.us` and `wiki.warframe.com` (configured in `next.config.ts`)
- Use `getImageUrl(item.imageName)` from `@/lib/warframe`
- Use Next.js `<Image>` with `fill` + `object-cover` in `aspect-square` containers, always with `unoptimized`

### Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name> -y
```

## Database Schema (Key Models)

- **User**: Auth + profile, roles (USER, VERIFIED, DEVELOPER, MODERATOR, ADMIN)
- **Item**: Synced Warframe items (warframes, weapons, companions)
- **Mod** / **Arcane**: Game mods and arcanes with stats
- **Build**: User-created builds with mod/arcane/shard configurations
- **BuildGuide**: Rich text (Lexical) attached to builds
- **Guide**: Standalone user guides
- **BuildVote** / **BuildFavorite**: Social features

## Environment Variables

Required in `.env`:

```txt
DATABASE_URL=postgresql://arsenyx:arsenyx_dev@localhost:5432/arsenyx
GITHUB_ID=...
GITHUB_SECRET=...
BETTER_AUTH_SECRET=...
USE_DATABASE=true  # Toggle DB mode vs static JSON
```

## Testing

Tests exist in `__tests__/` directories alongside source code:
- `src/lib/__tests__/build-codec.test.ts`
- `src/lib/warframe/__tests__/capacity.test.ts`
- `src/lib/warframe/__tests__/stat-parser.test.ts`
- `src/lib/warframe/__tests__/stats-calculator.test.ts`

Coverage is limited — be careful with refactoring untested code.

## Database Workflow

- **Development phase** — no migrations. Use `bun run db:push` to sync schema directly. Reset with `bun run db:push --force-reset` if needed, then `bun run db:sync` to re-populate.
- **Schema changes that drop/rename columns or add required fields** require a database reset. Always tell the user when a reset is needed before proceeding.
- **GIN index on `searchVector`** is created by `bun run db:sync` (not managed by Prisma). Must re-run sync after a reset.

## Gotchas

- **Satori (image generation)** — JSX renderer for server-side image gen. Only supports flexbox (no grid), inline `style` objects (no Tailwind/className), `.ttf`/`.woff` fonts (NOT `.woff2`). Returns `null` or `&&` short-circuits crash satori — always use ternaries with `<div style={{ display: "flex" }} />` fallbacks. ESLint `react/jsx-key` must be disabled since satori doesn't support `key` props.
- **`pg` and `sharp` must be external** — `serverExternalPackages: ["pg", "sharp"]` in `next.config.ts` prevents Turbopack bundling issues
- **Keyboard-first UX** — preserve keyboard navigation in browse components
- **Server Components first** — only add `"use client"` when actually needed
- **Don't modify `src/components/ui/`** — shadcn/ui primitives, override via className instead
- **Lexical editor is complex** — changes require understanding the plugin architecture
- **`USE_DATABASE` env var** — toggles between PostgreSQL queries and static JSON file loading
- **Always use `@/` import alias** — never use relative paths
- **Use `cn()` for conditional classes** — `import { cn } from "@/lib/utils"`
