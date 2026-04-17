# Arsenyx Migration Options

Two candidates for moving off Next.js. Context:

- AI writes most of the code → rewrite cost is low
- SEO no hard requirement
- Priority: clarity (no RSC server/client confusion) + low lock-in + devexperience
- Current stack kept: Prisma + PostgreSQL, Better Auth (GitHub OAuth), shadcn/ui, Tailwind v4, Bun, Playwright screenshot route, MDX guides

---

## Option A — TanStack Start (Vite + TanStack Router + SSR)

**What it is:** A full framework. Vite as the build tool, TanStack Router for routing, Nitro as the server layer. Routes can SSR or be client-only. Server work lives in `createServerFn` (RPC-style) or server routes (HTTP endpoints at `src/routes/api/*`).

### What it has going for it

- **One mental model, clearly split.** Everything is a client React component by default. Server code only exists in `createServerFn` or `.server.ts` files. No "is this running on server or client" ambiguity — which is the core Next.js pain point.
- **Type-safe routing.** TanStack Router has the best typed router in React — end-to-end typed params, search params, loaders. Real ergonomic win.
- **Loader + server function pattern.** Route `loader` runs on server during SSR and on client during navigation — same function, called from both sides. Cleaner than RSC.
- **Colocated route config.** Per-route `loader`, `head` (metadata), `beforeLoad` (auth guards), component — all in one file.
- **Vite dev speed.** Noticeably snappier HMR than Turbopack.
- **Vercel deploy works.** Nitro has a Vercel preset; auto-detected. Better Auth and Prisma both have first-class TanStack Start guides.
- **SSR is available if wanted later.** Build pages could SSR for link previews / faster first paint, even without caring about Google SEO.
- **Escape Next's release treadmill.** Smaller, less opinionated framework.

### What doesn't work as well

- **Young framework.** v1 stable since early 2026. Fewer Stack Overflow answers, fewer battle-tested patterns. You'll hit edge cases with 3 GitHub issues and no canonical fix.
- **Nitro bundling of heavy deps is fragile.** The Playwright + `@sparticuz/chromium-min` screenshot route is the likeliest source of pain — serverless bundling of chromium on Vercel under Nitro has known friction.
- **SSR hydration gotchas return.** Your keyboard-nav components are stateful — hydration mismatches that RSC hides will surface. Time sink during polish.
- **Still a framework → still lock-in.** `createServerFn`, route config shape, `head` API, Nitro server routes. ~15–20% of your codebase becomes Start-shaped. You're trading Next-lock-in for Start-lock-in of similar size, just to a smaller/younger ecosystem.
- **No ISR equivalent.** `revalidate = 86400` doesn't exist. You hand-roll cache headers or in-memory TTL caches. Minor for your app since build data is dynamic anyway.
- **No `next/og` equivalent.** Rebuild with Satori + resvg in a server route (~30–50 lines). Doesn't matter if you don't care about OG previews.
- **No PPR / partial prerender.** Streaming SSR + Suspense is the substitute.
- **One extra moving piece to understand (Nitro).** Another layer to reason about when debugging deploys.

### Shape of the migration

- `src/app/**/page.tsx` → `src/routes/**/*.tsx` (file-based, similar structure, `[slug]` → `$slug`)
- Server Components fetching data → route `loader` calling `createServerFn`
- Server Actions → `createServerFn({ method: 'POST' })`
- `/api/**` route handlers → server routes (H3/Nitro handler signature, not `NextRequest`)
- Better Auth: use `tanstackStartCookies` plugin, session via `createServerFn`, guards via `beforeLoad`
- Prisma: unchanged singleton pattern, only called from server fns
- Metadata: `export const metadata` → per-route `head: ({ loaderData }) => ({ meta, links })`
- Playwright screenshot: server route, same library, expect Nitro bundling fights
- Keep: shadcn/ui, Base UI, dnd-kit, Tailwind v4, all business logic

---

## Option B — Vite SPA + TanStack Router + Separate Hono API

**What it is:** No framework. Vite builds a pure client-side React app. TanStack Router handles routing in the browser. A separate Hono backend (runs on Bun) exposes your API. Two processes, two deploys, clear boundary.

**Reference:** [pingdotgg/t3code](https://github.com/pingdotgg/t3code) uses Vite + TanStack Router for its web app (no SSR, no framework).

### What it has going for it

- **Lowest lock-in of any option.** Your frontend is pure React + a router library. Your backend is Hono — runs on Bun, Node, Cloudflare Workers, Deno, Vercel functions, a VPS, anywhere. Swap either side independently.
- **Zero SSR = zero server/client confusion.** There is no server rendering. Everything in the frontend runs in the browser. The only "server" is your explicit API. The mental model collapses to "frontend fetches, backend responds" — the same pattern every non-Next app has used for 15 years.
- **No hydration mismatches, ever.** Because there's no hydration.
- **Fastest dev loop.** Vite SPA dev is as fast as frontend dev gets.
- **Hono is tiny and portable.** A few hundred lines of config max. Route handlers are boring Request → Response. No framework magic.
- **Backend is reusable.** Discord bot, mobile client, CLI — all could hit the same Hono API later. Arsenyx-adjacent projects could share it.
- **Playwright screenshot is just a Hono route on Bun.** No Nitro bundling weirdness. Chromium runs in a long-lived Bun process (or you containerize it). More predictable than serverless.
- **Better Auth works fine.** It has a vanilla mode — plug it into Hono as middleware. No framework adapter needed.
- **Stack matches t3code.** Theo ships this pattern; it's not exotic.

### What doesn't work as well

- **You assemble it yourself.** Vite config, router setup, Hono setup, auth wiring, CORS, cookie handling across two origins (or same-origin proxy). Everything a framework gives you for free is a line of config you write. AI handles most of it, but the *integration choices* are yours.
- **No SSR at all.** Slower first paint on cold visits (blank HTML, then JS loads, then renders). You said you don't care — but if that changes, adding SSR later is a real project.
- **Two deploys instead of one.** Frontend as static assets (Vercel/Netlify/Cloudflare Pages), backend as a Bun server (Fly, Railway, Render, a VPS, or Vercel Functions with a Hono adapter). More DNS, more env var surface, more things that can drift.
- **Auth cookies across origins.** If frontend and backend are on different domains, you deal with `SameSite` / `credentials: include` / CORS. Solvable (proxy in dev, same parent domain in prod) but a real setup cost.
- **Image handling is DIY.** No `next/image`. You serve images as-is or set up a Cloudflare/Bunny image CDN. You already use `unoptimized` so the loss is near zero.
- **OG images: DIY or skip.** Same as Start — Satori + resvg if you want them. You said you don't care.
- **MDX: DIY.** `@mdx-js/rollup` Vite plugin. Straightforward but one more thing to wire.
- **No file-based API routes.** Hono is code-based routing by default. You can do file-based with a convention, but it's manual.
- **The "which route needs auth" decision is on you.** No middleware.ts. You wrap Hono routes in auth middleware explicitly. Clearer, but more verbose.

### Shape of the migration

Two projects:

**Frontend (`arsenyx-web`):**
- Vite + React 19 + TypeScript
- TanStack Router (file-based routes under `src/routes/`)
- shadcn/ui, Base UI, Tailwind v4, dnd-kit — all unchanged
- Route loaders call the Hono API via `fetch` (or a typed client — Hono's `hc` RPC client gives end-to-end types if both projects live in a monorepo)
- Client-side auth: Better Auth React client + session hook

**Backend (`arsenyx-api`):**
- Hono on Bun
- Prisma (unchanged)
- Better Auth as Hono middleware
- Game data Maps loaded at startup (same pattern as today)
- Playwright screenshot endpoint
- `/api/auth/*` handled by Better Auth
- `/api/builds`, `/api/votes`, `/api/favorites`, `/api/search`, etc. as plain Hono routes

Optional: monorepo with Turborepo or Bun workspaces so the two share `packages/schema` (Prisma types, Zod schemas) and get typed RPC via Hono's `hc`.

---

## Side-by-side at a glance

|                       | Option A: TanStack Start                            | Option B: Vite SPA + Hono                               |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Lock-in               | Medium (Start-shaped ~15–20%)                       | **Lowest** (libraries, not framework)                   |
| Mental model          | Client by default + `createServerFn`                | **Pure client + separate API**                          |
| SSR                   | Yes (opt-in per route)                              | No                                                      |
| Dev speed             | Fast (Vite)                                         | **Fastest** (no SSR overhead)                           |
| Deploys               | One (Vercel via Nitro)                              | Two (static + Bun server)                               |
| Better Auth           | First-class TanStack plugin                         | Vanilla Hono middleware                                 |
| Prisma                | Unchanged                                           | Unchanged                                               |
| Playwright screenshot | Server route, bundling risk on Vercel               | **Plain Hono route, boring**                            |
| Hydration bugs        | Possible                                            | None (no hydration)                                     |
| Rewrite scope         | Frontend only                                       | Frontend + split out API                                |
| Future flexibility    | Medium                                              | **High** (swap either half)                             |
| Ecosystem maturity    | Young (v1 stable early 2026)                        | Hono is mature, Router is mature                        |
| Reference project     | [pingdotgg/lawn](https://github.com/pingdotgg/lawn) | [pingdotgg/t3code](https://github.com/pingdotgg/t3code) |

---

## Honest take

**Option A (Start)** is the smaller conceptual leap — one repo, one deploy, SSR if you want it, a framework that handles integration for you. Cost: you're an early adopter on a young framework, and you trade one lock-in for a similar-sized one.

**Option B (SPA + Hono)** is the larger upfront assembly but the smallest long-term commitment. No SSR means no hydration class of bugs. The mental model is obvious. Every piece is replaceable. Given "no SEO + AI writes most of it + dislikes lock-in" — the constraints that traditionally make this path expensive don't apply to you.

If portability matters more than convenience: **B**.
If one-repo-one-deploy matters more than portability: **A**.
