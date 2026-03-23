set dotenv-load := true
set positional-arguments := true
set shell := ["pwsh", "-NoLogo", "-Command"]

# Start DB and dev server.
default:
    docker compose up -d postgres
    bun dev

# First-run setup for a fresh clone.
setup:
    bun install
    docker compose up -d postgres
    bun run db:push
    bun run sync-data

# Update game data and reset DB.
reset:
    bun run update-data
    bunx prisma db push --force-reset
    Get-Content scripts/setup-search.sql | docker compose exec -T postgres psql -U arsenyx arsenyx

# Lint, format check, and test.
check:
    bun lint
    bun fmt:check
    bun test
