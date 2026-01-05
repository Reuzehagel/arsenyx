# Arsenix – Warframe Build Planner

Fast, keyboard-first Warframe build planner built with Next.js 16, Tailwind v4, and shadcn/ui. Data is sourced from the community-maintained `@wfcd/items` package.

## Tech Stack

- Next.js 16 (App Router, React 19)
- Tailwind CSS v4 + shadcn/ui (New York style)
- Bun (recommended package manager)
- Data: `@wfcd/items`

## Quick Start

```pwsh
# Install dependencies
bun install

# Start the dev server
bun dev

# Build for production
bun build

# Start the production server
bun start
```

Open `http://localhost:3000` in your browser.

## Warframe Data Sync

This project imports JSON data directly to avoid server-only fs usage in Next.js. Sync local copies from `@wfcd/items`:

```pwsh
# Copy data files from node_modules into src/data/warframe
bun run sync-data

# Update the @wfcd/items package and re-sync
bun run update-data
```

Data files live in `src/data/warframe/*.json` and are consumed by server-only utilities in `src/lib/warframe/items.ts`.

## Architecture

- `src/app/` – App Router pages; server components by default
- `src/components/` – UI and feature components
  - `ui/` – shadcn/ui primitives (Card, Tabs, etc.)
  - `browse/` – Browse UI (grid, filters, keyboard handler)
- `src/lib/warframe/` – Domain utilities
  - `items.ts` – Server-only item loading and mapping (imports JSON)
  - `index.ts` – Client-safe exports (types, categories, images, slugs)
  - `images.ts` – `getImageUrl()` helper for CDN and placeholders

### Server vs Client usage

```ts
// Server-only (uses JSON imports)
import { getItemsByCategory } from "@/lib/warframe/items";

// Client-safe utilities
import { getImageUrl, getItemUrl } from "@/lib/warframe";
```

## Conventions & Patterns

- Use `cn()` from `src/lib/utils.ts` to merge Tailwind classes
- shadcn/ui components have default spacing; override with `gap-0`, `py-0` where needed
- Images: prefer Next Image `fill` + `object-cover` inside `aspect-square` containers
- Badges: keep consistent sizing with `text-xs px-2 py-0.5`

## Keyboard Navigation

Keyboard-first interactions are handled in `src/components/browse/use-browse-keyboard.ts` and wired via `BrowseKeyboardHandler` (Suspense) on the Browse page.

## Useful Scripts

Defined in `package.json`:

- `dev` – `next dev`
- `build` – `next build`
- `start` – `next start`
- `sync-data` – `bun run scripts/sync-warframe-data.ts`
- `update-data` – `bun update @wfcd/items && bun run sync-data`

### Go utilities

Ad-hoc helpers live in `scripts/go/`:

- Scrape Overframe item IDs → `src/data/overframe/items.csv`: `go run ./scripts/go/scraper.go`
- Find the current max Overframe item ID: `go run ./scripts/go/find_max.go`

## Deployment

Standard Next.js deployment (e.g., Vercel). Ensure `@wfcd/items` data is synced into `src/data/warframe` prior to build.
