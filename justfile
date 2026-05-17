set dotenv-load := true
# Windows uses PowerShell; other platforms fall back to the default `sh`.
set windows-shell := ["pwsh", "-NoLogo", "-Command"]

# Run API + web together (default).
[parallel]
dev: api web

# Run only the Hono API. Expects DATABASE_URL in apps/api/.env to point at a Neon branch.
api:
    cd apps/api; bun run dev

# Run only the Vite SPA frontend.
web:
    cd apps/web; bun run dev

# Deploy the web app to Cloudflare Workers (Static Assets). Requires `wrangler login`.
deploy-web:
    cd apps/web; bun run deploy

# Deploy the API Worker.
deploy-api:
    cd apps/api; bun run deploy

# Regenerate the static browse data (items-index.json + per-item JSON).
build-items-index:
    bun run build:items

# Kill dev servers on ports 5173/5174 (Vite + fallback), 8787 (Hono).
[unix]
stop:
    #!/usr/bin/env sh
    for port in 5173 5174 8787; do
        if fuser -k "$port/tcp" >/dev/null 2>&1; then
            echo "Stopped port $port"
        else
            echo "Port $port already free"
        fi
    done

# Kill dev servers on ports 5173/5174 (Vite + fallback), 8787 (Hono).
[windows]
stop:
    @foreach ($port in 5173, 5174, 8787) { $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; if ($pids) { Write-Host "Stopping port $port (PID $($pids -join ', '))"; $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } else { Write-Host "Port $port already free" } }

# Interactive first-run setup. Asks for a Neon DATABASE_URL, generates a
# BETTER_AUTH_SECRET, pushes the schema, and seeds an admin@admin.com / admin
# user. Safe to re-run.
setup:
    bun run scripts/setup.ts

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
