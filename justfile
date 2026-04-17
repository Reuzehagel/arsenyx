set dotenv-load := true
set positional-arguments := true
set shell := ["pwsh", "-NoLogo", "-Command"]

# Run legacy Next.js app (while migration is in progress).
legacy:
    docker compose up -d postgres
    bun --cwd legacy run dev

# Run new Vite SPA + Hono API in parallel.
dev:
    docker compose up -d postgres
    Start-Process -NoNewWindow -FilePath bun -ArgumentList '--cwd','apps/api','run','dev'
    bun --cwd apps/web run dev

# Run only the new web frontend.
web:
    bun --cwd apps/web run dev

# Run only the new Hono API.
api:
    bun --cwd apps/api run dev

# First-run setup for a fresh clone.
setup:
    bun install
    docker compose up -d postgres
    bun --cwd legacy run db:push
    bun --cwd legacy run sync-data

# Update game data and reset DB (runs in legacy for now).
reset:
    bun --cwd legacy run update-data
    cd legacy; bunx prisma db push --force-reset
    Get-Content legacy/scripts/setup-search.sql | docker compose exec -T postgres psql -U arsenyx arsenyx

# Lint, format, test (legacy only for now).
check:
    bun --cwd legacy run lint
    bun --cwd legacy run fmt:check
    bun --cwd legacy run test
