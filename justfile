set dotenv-load := true
# Windows uses PowerShell; other platforms fall back to the default `sh`.
set windows-shell := ["pwsh", "-NoLogo", "-NoProfile", "-Command"]

# Run API + web together (default). Uses concurrently for clean Ctrl+C on Windows.
dev:
    bunx concurrently -k -n api,web -c blue,green "just api" "just web"

# Run only the Hono API. Expects DATABASE_URL in apps/api/.env to point at a Neon branch.
[working-directory('apps/api')]
api:
    bun run dev

# Run only the Vite SPA frontend.
[working-directory('apps/web')]
web:
    bun run dev

# Deploy the web app to Cloudflare Workers (Static Assets). Requires `wrangler login`.
[working-directory('apps/web')]
deploy-web:
    bun run deploy

# Deploy the API Worker.
[working-directory('apps/api')]
deploy-api:
    bun run deploy

# Regenerate the static browse data (items-index.json + per-item JSON),
# then mirror any new images into R2 and rewrite the catalog to our CDN.
# sync:images self-skips if R2 creds aren't in the root .env (CI's
# check:images guard then blocks a hotlinked catalog from merging).
build-items-index:
    bun run build:items
    bun run sync:images --skip-if-no-creds

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
# BETTER_AUTH_SECRET, pushes the schema, and seeds an admin user with a fresh
# random password (printed to stdout — copy it). Safe to re-run.
setup:
    bun run scripts/setup.ts

# Refresh game data: mirror DE PublicExport + wiki Lua, then rebuild
# the static catalog. Same steps the weekly CI cron runs.
update-data:
    bun run data:bump

# Ensure apps/web/src/routeTree.gen.ts exists. Vite's router-plugin
# generates it during build, but `bun run typecheck` (and editors) need
# it on a fresh checkout. No-op once present — first run takes ~8s.
[unix]
[working-directory('apps/web')]
gen:
    test -f src/routeTree.gen.ts || bun run build >/dev/null

[windows]
[working-directory('apps/web')]
gen:
    if (-not (Test-Path src/routeTree.gen.ts)) { bun run build | Out-Null }

# Typecheck + lint + format-check across apps/web, apps/api, packages/shared.
check: gen
    bun run typecheck
    bun run lint
    bun run fmt:check

# Auto-fix lint + format.
fix:
    bun run lint:fix
    bun run fmt

# Run vitest across all workspaces with tests, plus the build-pipeline tests
# under scripts/ (run via `bun test`). Keep in sync with the Test steps in
# .github/workflows/ci.yml when adding a workspace.
test:
    bun --filter=arsenyx-web --filter=arsenyx-api --filter=@arsenyx/shared run test
    bun test scripts/build/
