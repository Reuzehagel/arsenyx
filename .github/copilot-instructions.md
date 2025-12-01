# Arsenix - Warframe Build Planner

## Project Overview

Arsenix is a Next.js 16 Warframe build planner with keyboard-first navigation. Uses Bun as the package manager.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Server Components)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Data**: @wfcd/items (Warframe Community Data)
- **Package Manager**: Bun

## Commands

```bash
bun dev           # Start dev server
bun build         # Production build
bun run sync-data # Sync Warframe JSON data from @wfcd/items
bun run update-data # Update @wfcd/items package + sync data
```

## Architecture

### Data Flow (Server/Client Split)

- **Server-only**: `@/lib/warframe/items.ts` - imports JSON data directly, used only in Server Components
- **Client-safe**: `@/lib/warframe/index.ts` - re-exports types, categories, images, slugs
- **Static JSON**: `src/data/warframe/*.json` - copied from `node_modules/@wfcd/items/data/json/`

```typescript
// ✅ Server Component
import { getItemsByCategory } from "@/lib/warframe/items";

// ✅ Client Component (no fs dependency)
import { getImageUrl, type BrowseItem } from "@/lib/warframe";
```

### Component Structure

- `src/components/ui/` - shadcn/ui primitives (don't modify unless necessary)
- `src/components/browse/` - Browse page components with barrel export in `index.ts`
- `src/components/landing/` - Landing page components with barrel export

### Image Handling

Images come from WFCD CDN (`cdn.warframestat.us`). Use `getImageUrl()` from `@/lib/warframe/images.ts`:

```typescript
const imageUrl = getImageUrl(item.imageName); // Returns CDN URL or placeholder SVG
```

## Conventions

### Styling

- Use `cn()` utility from `@/lib/utils` to merge Tailwind classes
- shadcn/ui components have default gap/padding - override with `gap-0`, `py-0` etc.
- Consistent badge sizing: `text-xs px-2 py-0.5`

### TypeScript

- Strict types in `@/lib/warframe/types.ts` - `BrowseItem`, `BrowseCategory`, `Warframe`, `Weapon`
- Use `BrowseCategory` type for category routing: `"warframes" | "primary" | "secondary" | "melee" | "necramechs" | "companions"`

### File Organization

- Barrel exports: `index.ts` files in component folders and `@/lib/warframe/`
- Co-locate hooks with components: `use-browse-keyboard.ts` in `browse/`

### Adding New UI Components

```bash
npx shadcn@latest add <component-name> -y
```

## Key Files

- `src/lib/warframe/items.ts` - Item loading and filtering (server-only)
- `src/lib/warframe/types.ts` - All TypeScript interfaces
- `src/components/browse/browse-container.tsx` - Main browse page logic with client-side filtering
- `scripts/sync-warframe-data.ts` - Data sync script
