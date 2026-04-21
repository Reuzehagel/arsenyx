# Arsenyx

**A Warframe build planner for the web.** Create, share, and discover equipment builds with a keyboard-first UI, full mod and arcane management, and rich markdown guides.

Live at **[www.arsenyx.com](https://www.arsenyx.com)**.

---

## Features

- **Full build editor** — mods, arcanes, shards, helminth, exilus, forma — with live capacity and stat readouts
- **Browse everything** — warframes, primary/secondary/melee weapons, companions, archwings, and more
- **Markdown guides** — attach a writeup to any build, with GFM and syntax highlighting
- **Social layer** — vote, favorite, fork, and follow other players' builds
- **Overframe import** — paste an Overframe URL and get a first-class Arsenyx build
- **Shareable by link** — every build encodes to a short URL, no account needed to view
- **Bearer-token API** — publish builds from scripts, bots, or external tools

## Stack

| Layer | Tech |
|-------|------|
| Web | Vite · React 19 · TanStack Router · Tailwind v4 · shadcn/ui → **Cloudflare Pages** |
| API | Hono · Prisma 7 · Better Auth on **Cloudflare Workers** → `api.arsenyx.com` |
| Database | **Neon Postgres** (`eu-central-1`) |
| Screenshot service | Standalone Playwright worker behind a Cloudflare Tunnel |
| Game data | [`@wfcd/items`](https://www.npmjs.com/package/@wfcd/items), precomputed to static JSON at build time |

Bun workspaces throughout. No npm, no npx.

## Repo layout

- [`apps/web/`](apps/web/) — the SPA
- [`apps/api/`](apps/api/) — the Hono API
- [`packages/shared/`](packages/shared/) — types and codecs shared by both
- [`services/screenshot/`](services/screenshot/) — Playwright screenshot worker

Game data is **static** and served as JSON from `apps/web/public/data/`. User data (builds, votes, favorites, guides) is **dynamic** and lives in Postgres behind the API.

## Running locally

Requires Bun 1.2+, [just](https://github.com/casey/just), and a free Neon Postgres project ([neon.tech](https://neon.tech) — 1 minute signup).

```bash
bun install
just setup    # interactive — asks for your Neon DATABASE_URL, generates
              # an auth secret, pushes the schema, and seeds a dev user.
just dev      # web on :5173, api on :8787
```

Sign in at `http://localhost:5173` with **`admin@admin.com`** / **`admin`**.

GitHub OAuth is optional locally — fill `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `apps/api/.env` if you want to test the real OAuth flow. **In production, GitHub OAuth is the only sign-in method**; email+password is dev-only.

The full command list is in the [justfile](justfile); [docs/commands.md](docs/commands.md) covers build, database, and data-sync workflows.

For agent-assisted work, start with [CLAUDE.md](CLAUDE.md) — it points to the per-app guides in [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) and [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md). Open work is tracked in [TODO.md](TODO.md).

---

## Build Upload API

Arsenyx supports bearer-token build publishing, so you can push builds from a script or bot instead of clicking through the editor.

1. Sign in, open the user menu, and head to **Settings**.
2. Create a personal access token with the `build:write` scope.
3. Send it as `Authorization: Bearer <token>`.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/builds` | Create a build |
| `PUT` | `/api/v1/builds/:slug` | Update a build you own |
| `POST` | `/api/v1/imports/overframe` | Import an Overframe build by URL |

### Creating a build

`POST /api/v1/builds` and `PUT /api/v1/builds/:slug` accept a thin JSON payload:

```json
{
  "name": "Rhino Tank",
  "visibility": "PUBLIC",
  "itemUniqueName": "/Lotus/Powersuits/Rhino/Rhino",
  "itemCategory": "warframes",
  "organizationSlug": null,
  "guide": {
    "summary": "Optional short summary",
    "description": "Optional markdown guide"
  },
  "partnerBuildSlugs": [],
  "build": {
    "hasReactor": true,
    "slots": [
      {
        "slotId": "aura-0",
        "mod": {
          "uniqueName": "/Lotus/Upgrades/Mods/Aura/SteelCharge",
          "rank": 5
        }
      }
    ],
    "arcanes": [],
    "shards": [],
    "helminthAbility": null
  }
}
```

The server resolves canonical item / mod / arcane / shard data, recomputes derived capacity and forma fields, and rejects invalid writes with structured `4xx` JSON errors.

### Importing from Overframe

`POST /api/v1/imports/overframe` takes just a URL (plus optional overrides):

```json
{
  "url": "https://overframe.gg/build/935570/",
  "visibility": "PUBLIC",
  "organizationSlug": null,
  "nameOverride": "Optional custom title",
  "description": "Optional build description",
  "guide": {
    "summary": "Optional short summary",
    "description": "Optional markdown guide"
  },
  "partnerBuildSlugs": []
}
```

If `nameOverride`, `description`, or `guide` are omitted, Arsenyx preserves the Overframe metadata: the Overframe title becomes the build name, the page description becomes the guide summary, and the Overframe guide markdown becomes the guide body. Newlines in imported guides are stored as Markdown hard breaks so line-oriented text keeps its layout. Explicit `null` values still clear nullable fields. The response returns the created build plus any import warnings.
