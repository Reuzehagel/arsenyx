# arsenyx-screenshot

Standalone Playwright screenshot service. Runs on the homelab behind Cloudflare Tunnel, fronted by Cloudflare edge cache, with R2 as the persistent PNG store.

See the [deploy guide](./DEPLOY.md) for full setup.

## Endpoints

- `GET /builds/:slug/screenshot?bg=<hex>&format=<png|webp|jpeg>&refresh=<bool>`
  - Auth: allowed-referer (see `ALLOWED_SCREENSHOT_ORIGINS`) OR `Authorization: Bearer <PAT>` with `image:generate` scope.
  - Flow: R2 hit → serve stored PNG. R2 miss → Playwright renders `SCREENSHOT_BASE_URL/builds/:slug`, saves to R2, returns.
  - Response has `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` so Cloudflare caches at the edge.
- `POST /invalidate` (header `x-shared-secret: <SHARED_SECRET>`, body `{ "slug": "..." }`)
  - Deletes all R2 objects under `<slug>/` and purges the CF edge cache for that slug's variants.
- `GET /health`

## Local dev

```
cp .env.example .env   # fill in R2, CF, Neon values
bun install
bunx playwright install chromium   # only for local dev; Docker image has it pre-installed
bun run dev
```

Hit `http://localhost:3000/builds/<public-slug>/screenshot?format=png` (if you have a PAT, pass `Authorization: Bearer <token>`).
