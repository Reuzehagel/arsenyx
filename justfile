set dotenv-load := true
set shell := ["pwsh", "-NoLogo", "-Command"]

# Run API + web together (default).
[parallel]
dev: api web

# Run only the Hono API.
api:
    docker compose up -d postgres
    cd apps/api; bun run dev

# Run only the Vite SPA frontend.
web:
    cd apps/web; bun run dev

# Run legacy Next.js app (while migration is in progress).
legacy:
    docker compose up -d postgres
    cd legacy; bun run dev

# Run legacy app without starting Docker Postgres.
legacy-nodb:
    cd legacy; bun run dev

# Regenerate the static browse data (items-index.json + per-item JSON).
build-items-index:
    bun run build:items

# Kill dev servers on ports 5173 (Vite), 8787 (Hono), 3000 (legacy).
stop:
    @foreach ($port in 5173, 8787, 3000) { $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host "Stopping port $port (PID $($pids -join ', '))"; $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Host "Port $port already free" } }

# First-run setup for a fresh clone.
setup:
    bun install
    docker compose up -d postgres
    cd apps/api; bun run db:push

# Update game data and reset DB.
reset:
    cd legacy; bun run update-data
    cd legacy; bunx prisma db push --force-reset
    Get-Content legacy/scripts/setup-search.sql | docker compose exec -T postgres psql -U arsenyx arsenyx

# Lint + format-check (oxlint + oxfmt) across apps/web, apps/api, packages/shared.
check:
    bun run lint
    bun run fmt:check

# Auto-fix lint + format.
fix:
    bun run lint:fix
    bun run fmt
