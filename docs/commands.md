# Commands

```bash
bun install              # Install deps (runs prisma generate via postinstall)
bun dev                  # Dev server (Next.js + Turbopack)
bun build                # Production build (catches type errors bun dev misses)
bun lint                 # Oxlint
bun lint:fix             # Oxlint with auto-fix
bun fmt                  # Oxfmt (format src/)
bun fmt:check            # Oxfmt check mode
bun test                 # Run tests (Bun test runner)
bunx shadcn@latest add <component> -y  # Add shadcn/ui component

# Database
bun run db:push          # Push schema to local database (dev only)
bun run db:studio        # Open Prisma Studio
bunx prisma migrate dev --name <name>  # Create migration
bunx prisma migrate deploy             # Apply migrations (production)

# After local DB reset (psql not installed — must use Docker)
bash -c 'docker exec -i arsenyx-db psql "postgresql://arsenyx:arsenyx_dev@localhost:5432/arsenyx" < scripts/setup-search.sql'

# Warframe Data
bun run sync-data        # Copy WFCD JSON files to src/data/warframe/
bun run update-data      # Update @wfcd/items package + sync
```
