# Deploy — arsenyx-screenshot on the homelab

End-to-end setup for a $0 Cloudflare-fronted, Tunnel-protected, R2-cached Playwright screenshot service. Follow top to bottom.

## 0. Prerequisites

- Cloudflare account owning the `arsenyx.com` zone
- Homelab Docker host with the existing `homelab` compose stack
- Neon project for arsenyx (same one `apps/api` uses)

## 1. Create the R2 bucket

1. Cloudflare dashboard → **R2** → **Create bucket**
2. Name: `arsenyx-screenshots`. Region: **Automatic**.
3. After creation, open the bucket → **Settings** → copy the **Account ID** (shown at top right of the R2 overview).
4. **R2** → **Manage R2 API Tokens** → **Create API token**
   - Permission: **Object Read & Write**
   - Specify bucket: `arsenyx-screenshots`
   - TTL: Forever
   - Create → copy **Access Key ID** and **Secret Access Key** (shown once).

You now have: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=arsenyx-screenshots`.

## 2. Create a Cloudflare API token (for cache purge)

1. Dashboard → **My Profile** → **API Tokens** → **Create Token** → **Custom token**
2. Permissions: **Zone · Cache Purge · Purge**
3. Zone Resources: **Include · Specific zone · arsenyx.com**
4. Create → copy the token.
5. Copy the **Zone ID** from `arsenyx.com` zone overview (right sidebar).

You now have: `CF_ZONE_ID`, `CF_API_TOKEN`.

## 3. Create a scoped Neon role

Only grant `SELECT` on `"ApiKey"`. Run in Neon SQL Editor (or via `psql`):

```sql
CREATE ROLE screenshot_readonly WITH LOGIN PASSWORD 'pick-a-strong-one';
GRANT CONNECT ON DATABASE arsenyx TO screenshot_readonly;
GRANT USAGE ON SCHEMA public TO screenshot_readonly;
GRANT SELECT ON "ApiKey" TO screenshot_readonly;
```

Grab the connection string from Neon and swap in the new user. Example:

```
postgres://screenshot_readonly:pick-a-strong-one@ep-xxx.eu-central-1.aws.neon.tech/arsenyx?sslmode=require
```

This is `SCREENSHOT_DATABASE_URL` on the homelab.

## 4. Create a Cloudflare Tunnel (hides your home IP)

1. Dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**
2. Connector: **Cloudflared**. Name: `arsenyx-homelab`. Create.
3. On the install page, select **Docker** — copy the long token from the `docker run` command (the part after `--token `). Do **not** run the command from the UI; we'll run a cleaner version from compose.
4. Proceed to **Public Hostname** in the tunnel config:
   - Subdomain: `ss`
   - Domain: `arsenyx.com`
   - Service type: **HTTP**
   - URL: `screenshot:3000`
   - Save.

Cloudflare automatically creates a proxied CNAME for `ss.arsenyx.com`.

## 5. Generate a shared secret

On any machine:

```
openssl rand -hex 32
```

Save this — it's `SHARED_SECRET` (HL) / `SCREENSHOT_SERVICE_SECRET` (apps/api).

## 6. Copy the service onto the homelab

```
# On HL, in your compose project root (where docker-compose.yml lives)
git clone https://github.com/<you>/arsenyx.git arsenyx-repo
# or rsync services/screenshot/ from your dev machine
ln -s arsenyx-repo/services/screenshot ./screenshot
```

(Either symlink or plain copy — the compose file references `./screenshot` as the build context.)

## 7. Add services to your `docker-compose.yml`

Append these two services. Also add the env vars to your HL `.env` file.

```yaml
  screenshot:
    build: ./screenshot
    container_name: screenshot
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=${SCREENSHOT_DATABASE_URL}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET=arsenyx-screenshots
      - CF_ZONE_ID=${CF_ZONE_ID}
      - CF_API_TOKEN=${CF_API_TOKEN}
      - SHARED_SECRET=${SCREENSHOT_SERVICE_SECRET}
      - ALLOWED_SCREENSHOT_ORIGINS=https://arsenyx.com,https://www.arsenyx.com,https://profit-taker.com,https://testing.profit-taker.com
      - SCREENSHOT_BASE_URL=https://arsenyx.com
      - PUBLIC_BASE_URL=https://ss.arsenyx.com
    networks:
      - homelab
    shm_size: 1gb
    deploy:
      resources:
        limits:
          memory: 2G

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARED_TOKEN}
    networks:
      - homelab
```

Append to HL `.env`:

```
SCREENSHOT_DATABASE_URL=postgres://screenshot_readonly:...@ep-xxx.neon.tech/arsenyx?sslmode=require
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
CF_ZONE_ID=...
CF_API_TOKEN=...
SCREENSHOT_SERVICE_SECRET=...
CLOUDFLARED_TOKEN=...
```

## 8. Start it

```
docker compose up -d --build screenshot cloudflared
docker compose logs -f screenshot cloudflared
```

You should see:
- `cloudflared` → `Registered tunnel connection`
- `screenshot` → Hono listening on `:3000`

## 9. Add a Cloudflare Cache Rule

So CF caches PNGs at the edge (otherwise CF only caches static file extensions by default):

1. Dashboard → `arsenyx.com` → **Rules** → **Cache Rules** → **Create rule**
2. Name: `Cache screenshot service`
3. Matcher: Hostname equals `ss.arsenyx.com`
4. Action: **Eligible for cache**. Edge TTL: **Use cache-control header if present, bypass cache if not**.
5. Deploy.

## 10. Set apps/api env (in your Worker / Hono deploy)

```
SCREENSHOT_SERVICE_URL=https://ss.arsenyx.com
SCREENSHOT_SERVICE_SECRET=<same as HL SHARED_SECRET>
```

## 11. Verify

From your dev machine:

```bash
# 1. Health
curl https://ss.arsenyx.com/health
# → {"ok":true}

# 2. Render (referer auth)
curl -H "Referer: https://arsenyx.com/builds/xyz" \
     "https://ss.arsenyx.com/builds/<public-slug>/screenshot?format=png" \
     -o out.png
open out.png   # should match the build page visually

# 3. Cache hit (CF edge)
curl -I -H "Referer: https://arsenyx.com/builds/xyz" \
     "https://ss.arsenyx.com/builds/<public-slug>/screenshot?format=png"
# → cf-cache-status: HIT (after the first request propagates)

# 4. R2 warm cache
# purge CF cache via dashboard → curl again → x-screenshot-cache: r2-hit, response <500ms

# 5. Cold render
curl "https://ss.arsenyx.com/builds/<public-slug>/screenshot?format=png&refresh=true" \
     -H "Referer: https://arsenyx.com/builds/xyz" -o out2.png
# → takes 2-5s, x-screenshot-cache: bypass

# 6. PAT auth (no referer)
curl -H "Authorization: Bearer <PAT-with-image:generate>" \
     "https://ss.arsenyx.com/builds/<public-slug>/screenshot?format=webp" \
     -o out.webp

# 7. Unauthorized
curl -i "https://ss.arsenyx.com/builds/<slug>/screenshot"
# → 401

# 8. Invalidation
# Edit a build in apps/web, save. Then:
curl -I "https://ss.arsenyx.com/builds/<edited-slug>/screenshot?format=png&refresh=true"
# Then again without refresh — R2 should be re-populated fresh.
```

## Troubleshooting

- **`cloudflared` can't connect**: check `CLOUDFLARED_TOKEN` is the raw token (no `--token` prefix), and the tunnel shows "HEALTHY" in the CF dashboard.
- **Screenshots are blank or stale**: Playwright waits 2s for React hydration — if the build page is slow to render, bump `page.waitForTimeout` in `src/lib/playwright.ts`.
- **`NoSuchKey` errors in logs**: normal on first request for a given slug/bg/format — just means R2 miss, render path runs.
- **401 on valid-looking PAT**: PAT must have `image:generate` scope. Currently you'll need to seed this scope manually on an existing PAT (UI doesn't expose it yet) — update directly in the DB or via Prisma Studio.
