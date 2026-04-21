# Migrate Frontend: Cloudflare Pages → Workers Static Assets

## Context

Cloudflare is converging Pages into Workers. All new features go to Workers only; Pages gets maintenance only. Migrating now gives us a unified platform (both apps on Workers), access to future features, and slightly better asset-serving optimization (navigation requests bypass Worker invocation, reducing billable invocations).

Current state:
- **API** (`apps/api/`): Already on Workers with `wrangler.toml` + `wrangler deploy`
- **Web** (`apps/web/`): On Pages, deployed via CF dashboard GitHub integration — no local wrangler config at all
- No deployment CI/CD in the repo for either app (Pages auto-deploys via CF dashboard GitHub connector)

## What Changes

### 1. Create `apps/web/wrangler.toml`

The entire migration is essentially this one file:

```toml
name = "arsenyx-web"
compatibility_date = "2026-04-01"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"

routes = [
  { pattern = "www.arsenyx.com", custom_domain = true },
  { pattern = "arsenyx.com", custom_domain = true },
]
```

- `not_found_handling = "single-page-application"` — routes all unmatched paths to `/index.html`, required for TanStack Router client-side routing
- No `main` entry point needed (pure static assets, no Worker script)
- `custom_domain = true` — CF manages DNS/TLS automatically (same as Pages does today)

### 2. Add deploy script to `apps/web/package.json`

```json
"deploy": "wrangler deploy"
```

### 3. `apps/web/public/_headers` — no changes needed

Workers Static Assets natively supports `_headers` files placed in the asset directory. Since `public/` is copied into `dist/` during `vite build`, the file lands at `dist/_headers` automatically. Existing cache rules stay as-is.

### 4. CF Dashboard: Disconnect Pages, add Worker custom domains

- Delete or disconnect the Pages project from GitHub in the CF dashboard
- After first `wrangler deploy`, add `www.arsenyx.com` and `arsenyx.com` as Custom Domains on the new Worker in the dashboard (or wrangler handles it via `custom_domain = true`)

### 5. (Optional but recommended) Add `deploy:web` to root `package.json`

```json
"deploy:web": "bun --cwd apps/web run deploy"
```

Keeps the deploy pattern consistent with how `build:web` works.

## What Does NOT Change

- `vite build` → `dist/` — identical build output
- All React app code, TanStack Router, Tailwind — untouched
- `apps/web/public/_headers` — stays as-is, works natively
- `apps/web/vite.config.ts` — no changes
- Custom domains (`www.arsenyx.com`, `arsenyx.com`)

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/wrangler.toml` | **Create** — new file, core of the migration |
| `apps/web/package.json` | Add `"deploy": "wrangler deploy"` script |
| `package.json` (root) | Add `"deploy:web"` convenience script |

## Prerequisite: Install wrangler in web app

`apps/web/` currently has no wrangler dependency (unlike `apps/api/`). Add it as a dev dep:

```
bun add -D wrangler --cwd apps/web
```

## Deployment Flow After Migration

```
bun --cwd apps/web run build   # vite build → dist/
bun --cwd apps/web run deploy  # wrangler deploy (uploads dist/ to CF)
```

## CF Dashboard Steps (one-time, manual)

1. Run `wrangler deploy` from `apps/web/` — this creates the Worker
2. In CF dashboard → Workers & Pages → `arsenyx-web` → Settings → Triggers → Add Custom Domain: `www.arsenyx.com` and `arsenyx.com`
3. Delete the old Pages project (or keep it inactive — doesn't affect the Worker)

## Verification

1. `bun --cwd apps/web run build` — must succeed with no errors
2. `bunx wrangler dev --cwd apps/web` — local dev via wrangler; test that navigating to `/builds/some-id` serves `index.html` (SPA routing)
3. After deploy: visit `www.arsenyx.com` — check homepage loads
4. Navigate directly to a deep route (e.g. `/browse`) — must not 404
5. Check DevTools network tab: `/assets/*` files should have `Cache-Control: public, max-age=31536000, immutable` (from `_headers`)
6. Check `/index.html` has `Cache-Control: public, max-age=0, must-revalidate`

## Risk: Zero Downtime

Pages continues serving until the new Worker has custom domains attached and DNS propagates. Safe to deploy Worker first, test it on a `*.workers.dev` preview URL, then cut over custom domains.
