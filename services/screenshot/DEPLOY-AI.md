# Deploy — AI Agent Runbook

**Audience**: AI coding agent deploying `arsenyx-screenshot` to the user's homelab. Execute top to bottom. Pause at every `→ ASK USER` and wait for a reply before continuing.

## Conventions

- Track every value you capture in a running notes block (keep it in context, do not write to disk until step 7).
- Never print a secret back to the user in full — show first 4 + last 4 chars only.
- If any command fails, stop and surface the full error. Do not retry with guesses.

## Variables you will collect

```
R2_ACCOUNT_ID           (step 1)
R2_ACCESS_KEY_ID        (step 2)
R2_SECRET_ACCESS_KEY    (step 2)
R2_BUCKET               = arsenyx-screenshots
CF_ZONE_ID              (step 3)
CF_API_TOKEN            (step 3)
SCREENSHOT_DATABASE_URL (step 4)
SHARED_SECRET           (step 5, you generate)
CLOUDFLARED_TOKEN       (step 6)
HL_COMPOSE_DIR          (step 0, from user)
```

---

## Step 0 — Confirm environment

→ ASK USER:
1. "What is the absolute path to your homelab Docker Compose directory (the folder containing `docker-compose.yml`)?" Record as `HL_COMPOSE_DIR`.
2. "Is `wrangler` installed and authenticated (`wrangler whoami` succeeds)?" If no, tell them: `bun add -g wrangler && wrangler login`. Wait for confirmation.
3. "Do you have shell access to the homelab (SSH or local)?" Record how they'll run commands there.
4. "Confirm the arsenyx repo is checked out on the homelab, and give me the path to `services/screenshot/` on the homelab filesystem." Record as `HL_SERVICE_DIR`.

Do not proceed until all four are answered.

---

## Step 1 — Create R2 bucket

Run on the user's dev machine:

```bash
wrangler r2 bucket create arsenyx-screenshots
```

Expected output includes `Created bucket 'arsenyx-screenshots'`. If bucket already exists, treat as success and continue.

Get the account ID:

```bash
wrangler whoami
```

Parse the "Account ID" line. Record as `R2_ACCOUNT_ID`.

Verification:

```bash
wrangler r2 bucket list
```

Confirm `arsenyx-screenshots` appears.

---

## Step 2 — Create R2 API token

Wrangler cannot create R2 API tokens (account-level operation, dashboard only).

→ ASK USER:
> "Open https://dash.cloudflare.com/?to=/:account/r2/api-tokens and create a new API token:
> - Name: `arsenyx-screenshots-readwrite`
> - Permissions: Object Read & Write
> - Specify bucket: `arsenyx-screenshots`
> - TTL: Forever
>
> Paste the Access Key ID and Secret Access Key here. (These are shown only once — save them somewhere safe too.)"

Record as `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.

Verification: curl R2 with the token.

```bash
# AI: run this — substitute the values you captured
AWS_ACCESS_KEY_ID='<R2_ACCESS_KEY_ID>' \
AWS_SECRET_ACCESS_KEY='<R2_SECRET_ACCESS_KEY>' \
aws s3 ls s3://arsenyx-screenshots \
  --endpoint-url "https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
```

Expect empty output with exit 0. If `aws` is unavailable, skip verification; it will be tested end-to-end in step 11.

---

## Step 3 — Create Cloudflare zone API token + capture zone ID

Also dashboard-only.

→ ASK USER:
> "Open https://dash.cloudflare.com/profile/api-tokens → Create Token → Custom token.
> - Name: `arsenyx-cache-purge`
> - Permissions: Zone · Cache Purge · Purge
> - Zone Resources: Include · Specific zone · arsenyx.com
> Create. Paste the token here."

Record as `CF_API_TOKEN`.

Get zone ID via API:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones?name=arsenyx.com" \
  -H "Authorization: Bearer <CF_API_TOKEN>" \
  | jq -r '.result[0].id'
```

Record as `CF_ZONE_ID`. If `jq` not available, parse manually.

Verification — the token can purge:

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/<CF_ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":false,"files":["https://ss.arsenyx.com/health"]}'
```

Expect `"success":true`. (Purging a non-existent URL is a no-op but validates the token.)

---

## Step 4 — Create Neon read-only role

→ ASK USER:
> "Go to https://console.neon.tech → your arsenyx project → SQL Editor. Paste these commands and run. Then give me the connection string for the new `screenshot_readonly` user (Neon dashboard → Roles → screenshot_readonly → Connection string, select pooled, with password)."

Show them this SQL:

```sql
CREATE ROLE screenshot_readonly WITH LOGIN PASSWORD 'REPLACE_ME_STRONG';
GRANT CONNECT ON DATABASE arsenyx TO screenshot_readonly;
GRANT USAGE ON SCHEMA public TO screenshot_readonly;
GRANT SELECT ON "ApiKey" TO screenshot_readonly;
```

Tell them: "Replace `REPLACE_ME_STRONG` with a real password before running — use `openssl rand -hex 24`."

Record their pasted connection string as `SCREENSHOT_DATABASE_URL`. It must start with `postgres://screenshot_readonly:`.

Verification: connect and query.

```bash
psql '<SCREENSHOT_DATABASE_URL>' -c 'SELECT COUNT(*) FROM "ApiKey";'
```

Expect a number. If `psql` unavailable, skip; tested in step 11.

---

## Step 5 — Generate the shared secret

```bash
openssl rand -hex 32
```

Record as `SHARED_SECRET`. Do not echo back in full.

This value goes into both the HL service env (as `SHARED_SECRET`) and the apps/api env (as `SCREENSHOT_SERVICE_SECRET`).

---

## Step 6 — Create the Cloudflare Tunnel

Dashboard-only (tunnel creation requires interactive setup).

→ ASK USER:
> "Open https://one.dash.cloudflare.com → Networks → Tunnels → Create a tunnel.
> - Connector: Cloudflared
> - Name: `arsenyx-homelab`
> - Save
>
> On the next screen, select Docker as the environment. You'll see a `docker run` command containing `--token eyJ...`. Copy ONLY the token (the long string after `--token `) and paste it here. Do not run the docker command — our compose file will run cloudflared.
>
> Then go to Public Hostnames tab → Add:
> - Subdomain: `ss`
> - Domain: `arsenyx.com`
> - Type: HTTP
> - URL: `screenshot:3000`
> Save."

Record the token as `CLOUDFLARED_TOKEN`.

Verification (after step 8 finishes): `ss.arsenyx.com` resolves.

```bash
dig +short ss.arsenyx.com
```

Expect CF-proxied IPs.

---

## Step 7 — Write HL `.env` and update `docker-compose.yml`

Now everything goes onto the homelab. Connect to HL shell.

Append to `<HL_COMPOSE_DIR>/.env`:

```
# Screenshot service
SCREENSHOT_DATABASE_URL=<SCREENSHOT_DATABASE_URL>
R2_ACCOUNT_ID=<R2_ACCOUNT_ID>
R2_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
CF_ZONE_ID=<CF_ZONE_ID>
CF_API_TOKEN=<CF_API_TOKEN>
SCREENSHOT_SERVICE_SECRET=<SHARED_SECRET>
CLOUDFLARED_TOKEN=<CLOUDFLARED_TOKEN>
```

Append the two services to `<HL_COMPOSE_DIR>/docker-compose.yml` (under the top-level `services:` key, before `networks:`):

```yaml
  screenshot:
    build: <HL_SERVICE_DIR>
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

Replace `<HL_SERVICE_DIR>` with the actual path the user gave you in step 0. If it's a relative path from the compose dir, that's preferred (e.g. `./arsenyx/services/screenshot`).

→ ASK USER: "I'm about to write these changes to your `.env` and `docker-compose.yml`. Show me your current docker-compose.yml first, and confirm I can append." Only proceed after explicit OK.

---

## Step 8 — Start the services

From HL:

```bash
cd <HL_COMPOSE_DIR>
docker compose up -d --build screenshot cloudflared
```

Watch logs for 30 seconds:

```bash
docker compose logs --tail=50 screenshot cloudflared
```

Expected:
- `cloudflared`: `Registered tunnel connection` (4 connections is normal)
- `screenshot`: `Listening on http://0.0.0.0:3000` (or similar Hono startup log)

If either logs errors, stop and report them to the user.

---

## Step 9 — Configure Cloudflare Cache Rule

Dashboard-only.

→ ASK USER:
> "Open https://dash.cloudflare.com → arsenyx.com → Rules → Cache Rules → Create rule.
> - Name: `Cache screenshot service`
> - If: Hostname equals `ss.arsenyx.com`
> - Then: Eligible for cache. Edge TTL: Use cache-control header if present, bypass cache if not.
> - Deploy. Tell me when done."

Wait for confirmation.

---

## Step 10 — Wire apps/api env

→ ASK USER:
> "Where is apps/api deployed? (Cloudflare Workers / Fly / local)"

Based on answer:
- **Cloudflare Workers**: tell them to run
  ```
  cd apps/api
  bunx wrangler secret put SCREENSHOT_SERVICE_URL
  # paste: https://ss.arsenyx.com
  bunx wrangler secret put SCREENSHOT_SERVICE_SECRET
  # paste: <SHARED_SECRET>
  ```
- **Fly**: `fly secrets set SCREENSHOT_SERVICE_URL=https://ss.arsenyx.com SCREENSHOT_SERVICE_SECRET=<SHARED_SECRET>`
- **Local dev**: add both to `apps/api/.env`

---

## Step 11 — End-to-end verification

Pick any public build slug from the live site. Record as `<SLUG>`.

→ ASK USER: "Give me the slug of a PUBLIC build I can test with."

Run each check. Report pass/fail per check.

### 11.1 Health
```bash
curl -s https://ss.arsenyx.com/health
```
Expect: `{"ok":true}`

### 11.2 Referer auth + cold render
```bash
time curl -s -H "Referer: https://arsenyx.com/builds/<SLUG>" \
  "https://ss.arsenyx.com/builds/<SLUG>/screenshot?format=png" \
  -o /tmp/shot1.png
file /tmp/shot1.png
```
Expect: PNG image, 2–5s response.

### 11.3 R2 warm cache
```bash
time curl -s -H "Referer: https://arsenyx.com/builds/<SLUG>" \
  "https://ss.arsenyx.com/builds/<SLUG>/screenshot?format=png" \
  -D - -o /tmp/shot2.png | head -20
```
Expect: response <500ms, header `x-screenshot-cache: r2-hit` or CF `cf-cache-status: HIT`.

### 11.4 Unauthorized (no referer, no PAT)
```bash
curl -sI "https://ss.arsenyx.com/builds/<SLUG>/screenshot"
```
Expect: `HTTP/2 401`.

### 11.5 Invalidation
→ ASK USER: "Edit the build at arsenyx.com/builds/<SLUG> — change the name slightly, save. Tell me when done."

Then:
```bash
curl -s -H "Referer: https://arsenyx.com/builds/<SLUG>" \
  "https://ss.arsenyx.com/builds/<SLUG>/screenshot?format=png" \
  -D - -o /tmp/shot3.png | head -20
```
Expect: fresh render (slower response, header `x-screenshot-cache: miss`).

Compare `/tmp/shot1.png` and `/tmp/shot3.png`: they should differ in the name area.

### 11.6 PAT path (optional, requires seeded scope)
PATs created via settings UI don't have `image:generate` scope yet. Skip unless user has manually added it.

---

## Done

Report:
- Whether each 11.x check passed.
- The public URL pattern: `https://ss.arsenyx.com/builds/<slug>/screenshot?bg=<hex>&format=<png|webp|jpeg>`
- Remind user: PATs created via the settings UI currently default to `build:read`+`build:write`. To use the PAT auth path from third-party consumers, the UI needs to expose the `image:generate` scope (follow-up task).
