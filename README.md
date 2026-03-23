# Arsenyx – Warframe Build Planner

Create, share, and discover Warframe equipment builds. Features keyboard-first navigation, mod/arcane management, rich text guides, and social features (voting, favorites, forking).

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Server Components by default)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (New York theme)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: Better Auth with GitHub OAuth
- **Rich Text**: react-markdown with remark-gfm + rehype-highlight
- **Linting/Formatting**: Oxlint + Oxfmt
- **Package Manager**: Bun
- **Data Source**: `@wfcd/items` (Warframe Community Data)

## Quick Start

```bash
# Install dependencies
bun install

# Start PostgreSQL
docker compose up -d

# Push database schema
bun run db:push

# Setup full-text search (after fresh DB or reset)
psql $DATABASE_URL -f scripts/setup-search.sql

# Start the dev server
bun dev
```

Open http://localhost:3000 in your browser.

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://arsenyx:arsenyx_dev@localhost:5432/arsenyx
GITHUB_ID=...
GITHUB_SECRET=...
BETTER_AUTH_SECRET=...
```

## Scripts

```bash
# Development
bun dev                  # Dev server (Turbopack)
bun build                # Production build
bun start                # Production server

# Code Quality
bun lint                 # Oxlint
bun lint:fix             # Oxlint with auto-fix
bun fmt                  # Format with Oxfmt
bun fmt:check            # Check formatting

# Testing
bun test                 # Run tests
bun test:watch           # Watch mode
bun test:coverage        # Coverage report

# Database
bun run db:push          # Push schema to database
bun run db:migrate       # Run migrations
bun run db:studio        # Open Prisma Studio

# Warframe Data
bun run sync-data        # Copy WFCD JSON to src/data/warframe/
bun run update-data      # Update @wfcd/items + sync

# Overframe Import
bun run overframe:build-map  # Convert Overframe item mappings
```

## Architecture

```
src/
├── app/                    # App Router pages (server components by default)
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
│   └── settings/           # User settings
├── components/
│   ├── ui/                 # shadcn/ui primitives (do not modify)
│   ├── build-editor/       # Build creation/editing
│   ├── browse/             # Browse page (grid, filters, keyboard nav)
│   ├── mod-card/           # Mod card rendering
│   ├── arcane-card/        # Arcane card rendering
│   └── ...                 # Auth, guides, profile, landing, etc.
├── lib/
│   ├── warframe/           # Warframe domain logic
│   │   ├── items.ts        # SERVER-ONLY: JSON data loading
│   │   ├── index.ts        # Client-safe re-exports
│   │   ├── types.ts        # Warframe TypeScript types
│   │   ├── stats/          # Stat calculation engine
│   │   └── ...             # Mods, capacity, shards, helminth, etc.
│   ├── db/                 # Database queries (builds, users, votes, favorites)
│   ├── image/              # Satori image generation (build cards)
│   ├── overframe/          # Overframe import/decode logic
│   ├── auth.ts             # Better Auth server config
│   ├── build-codec.ts      # Build URL encoding/decoding
│   └── db.ts               # Prisma client singleton
├── data/
│   └── warframe/           # Static JSON from @wfcd/items
prisma/
└── schema.prisma           # Database schema
scripts/
├── sync-warframe-data.ts   # Copy JSON from node_modules
├── setup-search.sql        # Full-text search trigger + GIN index
├── convert-overframe-items.ts
└── go/                     # Ad-hoc Go helpers (Overframe scraping)
```

### Server vs Client Boundary

```ts
// Server (default) — can use database, fs, JSON loading
import { getItemsByCategory } from "@/lib/warframe/items";
import { prisma } from "@/lib/db";

// Client — must have "use client" directive
"use client";
import { getImageUrl, type BrowseItem } from "@/lib/warframe";
// Never import from "@/lib/warframe/items" or "@/lib/db" in client components
```

### Data Model

- **Game data** (items, mods, arcanes) lives in static JSON files loaded into in-memory Maps — not in the database.
- **User data** (builds, guides, votes, favorites) lives in PostgreSQL.

## Deployment

Hosted on **Vercel** (Next.js) + **Neon** (PostgreSQL). Auto-deploys on push to `main`.
