set dotenv-load := true
# Windows uses PowerShell; other platforms fall back to the default `sh`.
set windows-shell := ["pwsh", "-NoLogo", "-NoProfile", "-Command"]

# Run API + web together (default). Uses concurrently for clean Ctrl+C on Windows.
dev:
    bunx concurrently -k -n api,web -c blue,green "just api" "just web"

# Run only the Hono API. Expects DATABASE_URL in apps/api/.env to point at a PlanetScale branch.
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

# Refresh the two generated artifacts `typecheck` reads: apps/web's route tree
# and the Prisma client. Both are gitignored, so a fresh checkout has neither —
# and, more often, a `git pull` that adds a route or edits schema.prisma leaves
# a stale one behind. Stale artifacts surface as type errors in files you never
# touched, which is a bad way to learn you needed to regenerate something.
gen: gen-routes gen-prisma

# ~1.5s, so it always runs rather than trying to outsmart the schema mtime.
[working-directory('apps/api')]
gen-prisma:
    @bunx prisma generate

# A full vite build (~8s), so this one is gated on the route tree being older
# than anything under src/routes. The tree is stamped afterwards because the
# plugin skips the write when the content is unchanged, which would otherwise
# leave it permanently older than its inputs and rebuild on every run.
[unix]
[working-directory('apps/web')]
gen-routes:
    #!/usr/bin/env sh
    tree=src/routeTree.gen.ts
    if [ ! -f "$tree" ] || [ -n "$(find src/routes -newer "$tree" -print -quit)" ]; then
        bun run build >/dev/null && touch "$tree"
    fi

[windows]
[working-directory('apps/web')]
gen-routes:
    @$tree = 'src/routeTree.gen.ts'; $stale = -not (Test-Path $tree); if (-not $stale) { $stamp = (Get-Item $tree).LastWriteTimeUtc; $stale = [bool](@(Get-Item src/routes) + @(Get-ChildItem src/routes -Recurse -Force) | Where-Object { $_.LastWriteTimeUtc -gt $stamp } | Select-Object -First 1) }; if ($stale) { bun run build | Out-Null; (Get-Item $tree).LastWriteTimeUtc = (Get-Date).ToUniversalTime() }

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
