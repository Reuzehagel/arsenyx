# CLAUDE.md - Arsenyx

## Project Overview

Arsenyx is a Warframe build planner — create, share, and discover equipment builds. Features keyboard-first navigation, rich text guides, mod/arcane management, and social features (voting, favorites, forking).

Game data (items, mods, arcanes) comes from static JSON files (`src/data/warframe/`) loaded into in-memory Maps at server start — not from the database. This is intentional: game data changes with Warframe patches, not user actions. User data (builds, guides, votes, favorites) lives in PostgreSQL.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Server Components by default)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (New York theme)
- **Database**: PostgreSQL via Prisma ORM with `@prisma/adapter-pg`
- **Authentication**: Better Auth with GitHub OAuth
- **Rich Text**: react-markdown with remark-gfm + rehype-highlight
- **Linting/Formatting**: Oxlint + Oxfmt (with Tailwind class sorting)
- **Package Manager**: Bun (required — never use npm/npx)
- **Data Source**: `@wfcd/items` (Warframe Community Data)

## Commands

```bash
bun install              # Install deps (runs prisma generate via postinstall)
bun dev                  # Dev server (Next.js + Turbopack)
bun build                # Production build (catches type errors bun dev misses)
bun lint                 # Oxlint
bun lint:fix             # Oxlint with auto-fix
bun fmt                  # Oxfmt (format src/)
bun fmt:check            # Oxfmt check mode
bun test                 # Run tests (Bun test runner)
bun test:watch           # Watch mode
bun test:coverage        # Coverage report
bunx shadcn@latest add <component> -y  # Add shadcn/ui component

# Database
bun run db:push          # Push schema to database
bun run db:studio        # Open Prisma Studio

# After DB reset (psql not installed locally — must use Docker)
bash -c 'docker exec -i arsenyx-db psql "postgresql://arsenyx:arsenyx_dev@localhost:5432/arsenyx" < scripts/setup-search.sql'

# Warframe Data
bun run sync-data        # Copy WFCD JSON files to src/data/warframe/
bun run update-data      # Update @wfcd/items package + sync
```

## Development Workflow

1. `docker compose up -d` — start PostgreSQL
2. `bun run db:push` — push schema
3. Setup search (after reset only): `bash -c 'docker exec -i arsenyx-db psql "postgresql://arsenyx:arsenyx_dev@localhost:5432/arsenyx" < scripts/setup-search.sql'`
4. `bun dev` — start dev server at http://localhost:3000

## Boundaries

### Always

- Run `bun build` before claiming work is done — `bun dev` hides type errors
- Invoke the `shadcn` skill before any frontend work (new components, UI changes, styling)
- Use Server Components by default; only add `"use client"` when actually needed
- Preserve keyboard navigation in browse components
- Use `unoptimized` on all Next.js `<Image>` components

### Ask First

- Schema changes that drop/rename columns or add required fields (requires DB reset)
- Adding new dependencies

### Never

- Modify `src/components/ui/` — these are shadcn/ui primitives, override via className
- Import from `@/lib/warframe/items` or `@/lib/db` in client components (server-only modules)
- Use npm/npx — always use bun/bunx
- Use `python` directly — always use `uv` instead

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

### Images

- CDN: `cdn.warframestat.us` and `wiki.warframe.com` (configured in `next.config.ts`)
- Use `getImageUrl(item.imageName)` from `@/lib/warframe`
- Use Next.js `<Image>` with `fill` + `object-cover` in `aspect-square` containers, always with `unoptimized`

## Key Files

- `prisma/schema.prisma` — database schema (User, Build, BuildGuide, Guide, BuildVote, BuildFavorite)
- `src/lib/warframe/items.ts` — server-only game data loading (in-memory Maps)
- `src/lib/warframe/types.ts` — all Warframe TypeScript types
- `src/lib/build-codec.ts` — build URL encoding/decoding
- `src/lib/db.ts` — Prisma client singleton (`pool as any` cast needed due to `@types/pg` mismatch)
- `.env.example` — required environment variables (copy to `.env` and fill in secrets)

## Gotchas

- **`bun dev` hides type errors** — Turbopack dev mode skips strict TS checks. Always `bun build` before pushing.
- **Satori (image generation)** — Only supports flexbox (no grid), inline `style` objects (no Tailwind/className), `.ttf`/`.woff` fonts (NOT `.woff2`). `null` or `&&` short-circuits crash it — always use ternaries with `<div style={{ display: "flex" }} />` fallbacks.
- **`pg` and `sharp` must be external** — `serverExternalPackages: ["pg", "sharp"]` in `next.config.ts` prevents Turbopack bundling issues.
- **PowerShell doesn't support `<` redirection** — wrap in `bash -c '...'` when piping stdin to Docker.
- **Base UI Slider** — `onValueChange`/`onValueCommitted` use `(value: number | readonly number[])`, not just `number`.
- **Base UI Select** — `onValueChange` passes `string | null`, not just `string`.

## Database Workflow

- **No migrations in dev** — use `bun run db:push` to sync schema. Reset with `bun run db:push --force-reset`.
- **After any reset** — re-run `setup-search.sql` via Docker (see Commands).
- **Prod (Vercel + Neon)** — `main` branch auto-deploys. After Neon DB reset: `DATABASE_URL=<neon-url> bunx prisma db push`, then run `setup-search.sql` via Neon SQL Editor.

## Testing

Test files live in `__tests__/` directories alongside source code. Coverage is still partial — be careful refactoring untested code.
