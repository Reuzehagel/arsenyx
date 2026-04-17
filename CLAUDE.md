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

- Update the changelog (`src/app/changelog/page.tsx`) when completing user-facing changes — add entries to the `CHANGELOG` array
- Run `bun build` before claiming work is done — `bun dev` hides type errors
- Invoke the `shadcn` skill before any frontend work (new components, UI changes, styling). **Monorepo gotcha:** the skill's bootstrap runs `shadcn info` from the current working directory, which errors at the monorepo root (`error: monorepo_root`). Workaround: either start Claude Code with cwd `apps/web` (preferred), or skip the skill and work with the CLI directly — `cd apps/web && bunx shadcn@latest view <name>` to inspect, `cd apps/web && bunx shadcn@latest add <name> -c apps/web` to add. When adding a component whose deps conflict with our customised `button`/`input`, fetch the file via `view` + write manually to `apps/web/src/components/ui/` and rewrite the `@/registry/base-nova/...` imports to `@/lib/utils` and `@/components/ui/...`
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

## Architecture principles

- **Prefer static/precomputed over runtime-served.** When data is read-heavy and changes rarely (game data, slim indexes, per-item JSON), emit it as a static asset at build time and ship via the CDN. Don't spin up an API route to serve something that could be a file. The backend exists for user data and mutations, not read-caching game data.
- **Default to "does this need a server?" and say no when you can.** Each server-side touchpoint is latency, cost, and scale-to-zero friction. A browse page that loads a 200KB static JSON and filters client-side beats a Hono route every time.

## Data Quirks

- WFCD item fields can vary types across items (e.g. `aura` is `string` for most warframes but `string[]` for Jade) — always handle both forms

## Reference Docs

- [docs/commands.md](docs/commands.md) — Build, test, database, and data sync commands
- [docs/gotchas.md](docs/gotchas.md) — Non-obvious pitfalls (Satori, Base UI, PowerShell, etc.)
- [docs/database.md](docs/database.md) — Local dev setup, migrations, and prod deployment
