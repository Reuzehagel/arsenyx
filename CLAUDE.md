# CLAUDE.md - Arsenyx

## Project Overview

Arsenyx is a Warframe build planner — create, share, and discover equipment builds. Features keyboard-first navigation, rich text guides, mod/arcane management, and social features (voting, favorites, forking).

Game data (items, mods, arcanes) comes from static JSON files (`src/data/warframe/`) loaded into in-memory Maps at server start — not from the database. User data (builds, guides, votes, favorites) lives in PostgreSQL.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Server Components by default)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (New York theme)
- **Database**: PostgreSQL via Prisma ORM with `@prisma/adapter-pg`
- **Auth**: Better Auth with GitHub OAuth
- **Linting/Formatting**: Oxlint + Oxfmt (with Tailwind class sorting)
- **Package Manager**: Bun (required — never use npm/npx)
- **Data Source**: `@wfcd/items` (Warframe Community Data)

## Boundaries

### Always

- Run `bun build` before claiming work is done — `bun dev` hides type errors
- Invoke the `shadcn` skill before any frontend work (new components, UI changes, styling)
- Use Server Components by default; only add `"use client"` when actually needed
- Preserve keyboard navigation in browse components
- Use `unoptimized` on all Next.js `<Image>` components
- Never import from `@/lib/warframe/items` or `@/lib/db` in client components (server-only)
- Use `uv` instead of `python` directly

### Ask First

- Schema changes that drop/rename columns or add required fields
- Adding new dependencies

### Never

- Modify `src/components/ui/` — override via className instead
- Use npm/npx — always use bun/bunx

## Reference Docs

- [docs/commands.md](docs/commands.md) — Build, test, database, and data sync commands
- [docs/gotchas.md](docs/gotchas.md) — Non-obvious pitfalls (Satori, Base UI, PowerShell, etc.)
- [docs/database.md](docs/database.md) — Local dev setup, migrations, and prod deployment
