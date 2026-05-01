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
- **Bearer-token API** — publish builds from scripts, bots, or external tools — see [arsenyx.com/docs](https://www.arsenyx.com/docs)

## Stack

| Layer | Tech |
|-------|------|
| Web | Vite · React 19 · TanStack Router · Tailwind v4 · shadcn/ui → **Cloudflare Pages** |
| API | Hono · Prisma 7 · Better Auth on **Cloudflare Workers** → `api.arsenyx.com` |
| Database | **Neon Postgres** (`eu-central-1`) |
| Game data | [`@wfcd/items`](https://www.npmjs.com/package/@wfcd/items), precomputed to static JSON at build time |

## Contributing

Setup, repo layout, and local dev workflow live in [CONTRIBUTING.md](CONTRIBUTING.md).
