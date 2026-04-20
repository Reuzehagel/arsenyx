set dotenv-load := true
set shell := ["pwsh", "-NoLogo", "-Command"]

# Run API + web together (default).
[parallel]
dev: api web

# Run only the Hono API. Expects DATABASE_URL in apps/api/.env to point at a Neon branch.
api:
    cd apps/api; bun run dev

# Run only the Vite SPA frontend.
web:
    cd apps/web; bun run dev

# Regenerate the static browse data (items-index.json + per-item JSON).
build-items-index:
    bun run build:items

# Kill dev servers on ports 5173 (Vite), 8787 (Hono).
stop:
    @foreach ($port in 5173, 8787) { $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host "Stopping port $port (PID $($pids -join ', '))"; $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Host "Port $port already free" } }

# First-run setup for a fresh clone. Requires apps/api/.env with a Neon DATABASE_URL.
setup:
    bun install
    cd apps/api; bun run db:push

# Update game data (WFCD items + browse index).
update-data:
    bun run update-data

# Lint + format-check (oxlint + oxfmt) across apps/web, apps/api, packages/shared.
check:
    bun run lint
    bun run fmt:check

# Auto-fix lint + format.
fix:
    bun run lint:fix
    bun run fmt
