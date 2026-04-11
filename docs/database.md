# Database Workflow

- **Local dev**: `docker compose up -d` → `bun run db:push` → re-run `setup-search.sql` after resets.
- **Prod (Vercel + Neon)**: `main` auto-deploys. Migration `202604071430_build_search_infrastructure` handles search setup.
- **New schema changes**: create a migration with `bunx prisma migrate dev --name descriptive_name`.
- **Deploy migrations**: `$env:DATABASE_URL = "<neon-url>"; bunx prisma migrate deploy` (PowerShell).
