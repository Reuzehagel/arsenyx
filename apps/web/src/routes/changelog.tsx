import { createFileRoute } from "@tanstack/react-router";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

interface ChangelogEntry {
  date: string;
  version?: string;
  changes: {
    type: "feat" | "fix" | "refactor" | "chore";
    description: string;
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-04-18",
    changes: [
      {
        type: "feat",
        description:
          "Publish dialog in the build editor — Save no longer silently commits as Public. New builds open a dialog first to pick visibility (Public / Unlisted / Private) and a publish target (yourself now; Organizations placeholder for later). Existing builds still save silently, but the editor header gets a Settings button that re-opens the dialog so you can change visibility or owner after the fact",
      },
      {
        type: "feat",
        description:
          "View counts actually count — `GET /builds/:slug` increments `viewCount` when a non-owner loads the page, deduped per browser per 12h via a per-build `vw_<slug>` cookie. Owners viewing their own builds don't pad the number",
      },
      {
        type: "chore",
        description:
          "Unified vote iconography — build cards swap the `ThumbsUp` glyph for `ArrowBigUp` to match the build viewer's upvote button, so the same action looks the same everywhere",
      },
      {
        type: "feat",
        description:
          "Public profile pages — `/profile/<username>` shows the user's avatar, name, handle, bio, badges (verified / community leader / moderator / admin), join date, and aggregate stats (builds, total votes / favorites / views), with a paginated grid of their public builds underneath. The user-menu \"My Profile\" entry now goes to your own page (`/profile` redirects to `/profile/<your-username>`). Backend exposes `GET /users/:username` and `GET /users/:username/builds`",
      },
      {
        type: "feat",
        description:
          "Vote and favorite buttons on the build viewer — signed-in users can upvote (not their own builds) or favorite any build they can see, with optimistic counts. Unauthenticated clicks bounce to sign-in. New `/favorites` page lists everything you've favorited, paginated and sortable, mirroring `/builds/mine`. Backend exposes `POST/DELETE /builds/:slug/{vote,favorite}` and `GET /builds/favorites`, and `GET /builds/:slug` now reports `viewerHasVoted` / `viewerHasFavorited`",
      },
      {
        type: "feat",
        description:
          "User menu gets real entries — My Profile, My Builds, My Favorites, Settings, Sign out, plus a conditional Admin entry for staff. Settings opens an in-app dialog (sidebar layout, sidebar-13 style) with Appearance / Profile / Connected accounts / Notifications / Privacy / Advanced sections; the standalone header theme toggle is gone — theme now lives under Appearance",
      },
      {
        type: "feat",
        description:
          "Command palette — Ctrl/Cmd+K from anywhere opens a universal search (shadcn Command) with three sections: navigation shortcuts, Warframe items (filtered from the static items index), and community builds (debounced against the `/builds?q=` endpoint). A \"Search all builds for …\" action kicks the query over to `/builds` when you want the full grid. Header gets a proper search button with a ⌘K hint",
      },
      {
        type: "feat",
        description:
          "Builds browsing — `/builds` lists the community's public builds as image cards (newest / recently-updated sort, 24 per page), and `/builds/mine` lists your authored builds (auth-gated, redirects to sign-in). Full-text search lands alongside: a GIN-indexed `tsvector` on name / itemName / description powers `websearch_to_tsquery` matching, ranked by `ts_rank`, and the URL-synced search input + category tabs on `/builds` are wired live",
      },
      {
        type: "chore",
        description:
          "`just dev` no longer starts the legacy Docker Postgres — the new stack talks to Neon, so the container is only needed for `just legacy`",
      },
      {
        type: "feat",
        description:
          "Build viewer uses the full editor layout in read-only mode — same ItemSidebar (capacity, reactor switch, shards, helminth, stats), same ModGrid with innate polarities, same ArcaneRow, plus the markdown guide underneath. A new `readOnly` prop on ModSlot / ArcaneSlot / ItemSidebar turns off click/hover/picker popovers and disables the reactor switch so the viewer doesn't feel like a broken editor",
      },
      {
        type: "feat",
        description:
          "Editing saved builds round-trips through the editor — `/builds/$slug` has an Edit button for the owner that opens `/create?build=<slug>`, the editor hydrates slots / forma / arcanes / shards / helminth / reactor / name / guide from the saved state, and Save switches to `PATCH /builds/:slug` (guide is upserted) instead of creating a new build",
      },
      {
        type: "feat",
        description:
          "Saving builds works end-to-end — `POST /builds` creates a build for the signed-in user with a unique 10-char slug, and the editor's header Save button serializes the current grid / arcanes / shards / reactor / helminth / guide and redirects to the new `/builds/$slug` page on success. Unauthenticated clicks bounce to `/auth/signin`",
      },
      {
        type: "feat",
        description:
          "Build view foundation — full Prisma schema (builds, guides, orgs, votes, favorites, api keys) now lives in `apps/api` and is live on the Neon dev branch. New `GET /builds/:slug` Hono endpoint enforces owner / public / unlisted / org-member visibility, and `/builds/$slug` renders the build shell with metadata, description, and markdown guide (GFM). Mod grid rendering arrives with Slice 6",
      },
      {
        type: "feat",
        description:
          "Auth foundation — Hono API with Better Auth and GitHub OAuth, Prisma schema for User/Account/Session/Verification on a new Neon branch, `/auth/signin` and `/auth/error` pages, and a UserMenu in the header (sign-in, avatar, sign-out). Builds/votes/favorites still come in Slice 4 once the schema ports over",
      },
      {
        type: "feat",
        description:
          "Build guide editor — optional summary line (160 char cap) and a markdown description with Edit/Preview tabs (GFM: tables, task lists, links, fenced code with syntax highlighting). The textarea auto-continues `-`/`*`/`1.`/`- [ ]` lists on Enter (and exits on an empty item), Tab/Shift+Tab indents and dedents, Ctrl+B / Ctrl+I wraps the selection, and pasting a URL over selected text turns it into a `[text](url)` link. Partner-builds dropdown is stubbed until save support lands",
      },
      {
        type: "refactor",
        description:
          "Browse / editor UI polish — dropped the orange Prime badge on item detail pages (Prime items are still surfaced by name and by the Prime-only filter), default shadcn styling on the category tabs, and unified widths on the filter selects",
      },
      {
        type: "feat",
        description:
          "Companions now show health/shield/armor/energy with mod recalc; archwing suits (Itzal, Odonata) render as warframes with abilities, while arch-guns / arch-melee fall through to the weapon panel — all auto-detected from item data",
      },
      {
        type: "feat",
        description:
          "Ability efficiency caps at 175% (and duration at 12.5%, range at 34%) — capped stats render the capped value with the uncapped value in a muted suffix, and the popover labels \"Uncapped\" vs \"Capped\" explicitly",
      },
      {
        type: "feat",
        description:
          "Weapon damage breakdown splits into Physical and Elemental sections, and every row (Impact, Viral, Total, etc.) is hoverable — the popover groups contributors by source (Base Damage, Cold, Toxin, Multishot…) so you can see exactly which mods combined into Viral or which mods produced a given total",
      },
      {
        type: "feat",
        description:
          "Stats turn green when they improve and red when they regress — hover over any changed stat to see the attributing mods/arcanes/shards with their percent/flat contributions and the final multiplier formula (reload time is inverted — shorter is better)",
      },
      {
        type: "feat",
        description:
          "Stats panel recalculates from placed mods, arcanes, shards, and rivens — weapons show per-attack sections (e.g. Acceltra's Rocket Impact + Rocket Explosion) with physical/elemental damage breakdowns and a multishot-adjusted total; warframes show modified health/shield/armor/energy and ability strength/duration/efficiency/range",
      },
      {
        type: "feat",
        description:
          "Riven editor — on weapons, a synthetic Riven Mod appears in search; placing or clicking the pencil opens a dialog for polarity, drain, 3 positives + 1 negative (stat list filters to melee-only or gun-only)",
      },
      {
        type: "feat",
        description:
          "Exilus slot now appears on weapons (primary, secondary, melee, archwing, companion weapons) — previously only warframes and companions had one",
      },
      {
        type: "fix",
        description:
          "Thrown secondaries (e.g. Aegrit) now pull in pistol-compatible mods instead of showing an empty search",
      },
      {
        type: "feat",
        description:
          "Arcane slots — click to open a searchable picker, right-click to remove, +/- to rank while hovered",
      },
      {
        type: "feat",
        description:
          "Placed mods now reflect slot polarity — drain turns green/red and adjusts for matching or mismatching polarity",
      },
    ],
  },
  {
    date: "2026-04-17",
    changes: [
      {
        type: "refactor",
        description:
          "Begin migration from Next.js to Vite + TanStack Router — homepage, browse (with filters/sort), and static pages ported",
      },
      {
        type: "feat",
        description:
          "Item detail pages — per-item static JSON served from the CDN, no backend required",
      },
      {
        type: "feat",
        description: "Press / to focus the search input on the Browse page",
      },
      {
        type: "feat",
        description:
          "Build editor shell — /create?item=… with item sidebar and breadcrumb (mod editor + save land in follow-up slices)",
      },
      {
        type: "feat",
        description:
          "Compatible Mods grid — 2-row horizontal scroll with search, sort, and rarity/polarity filters; positions stay stable when filtering (no reshuffling)",
      },
      {
        type: "feat",
        description:
          "Click-to-place mods — click a compatible mod to drop it in the next free slot (aura / exilus / normal); click a filled slot to remove. Mods placed at max rank. Ranks, polarities, and capacity math land in a follow-up slice",
      },
      {
        type: "feat",
        description:
          "Mod grid visuals — centered layout with per-slot polarity stamps from the item's innate polarities, `+` affordance on empty slots, and arcane slot placeholders (2 for warframes/necramechs, 1 for weapons)",
      },
      {
        type: "feat",
        description:
          "Slot targeting + polarity picker — click an empty slot to select it and open a popover to forma any polarity; the next mod you click lands in that slot. Placed mods default to max rank; hover a placed mod and press `-`/`=` to change its rank",
      },
    ],
  },
  {
    date: "2026-04-16",
    changes: [
      {
        type: "feat",
        description:
          "Zaw support — select Grip and Link components for Zaw Strike builds with dynamic stat recalculation",
      },
      {
        type: "fix",
        description:
          "Fixed Zaw Strikes showing no mods and zero stats on the browse page",
      },
    ],
  },
  {
    date: "2026-04-15",
    changes: [
      {
        type: "feat",
        description:
          "Riven mod support — add and configure Riven mods on weapon builds with custom stats, drain, and polarity",
      },
    ],
  },
  {
    date: "2026-04-13",
    changes: [
      {
        type: "fix",
        description:
          "Fixed mobile drag-and-drop in mod editor — vertical dragging no longer triggers page scroll",
      },
      {
        type: "fix",
        description: "Carry over subsumed helminth ability when forking a build",
      },
      {
        type: "feat",
        description: "Added sort options to profile and organization pages",
      },
      {
        type: "fix",
        description: "Improved mobile layout for build editor and navigation",
      },
      {
        type: "refactor",
        description: "Extracted shared sort constants and improved type safety",
      },
    ],
  },
  {
    date: "2026-04-12",
    changes: [
      {
        type: "fix",
        description:
          "Support dual aura slots (Jade), fix build save validation, and correct archwing layouts",
      },
      {
        type: "fix",
        description: "Reduced mod card rarity color overlay opacity for subtler tint",
      },
      {
        type: "feat",
        description: "Added delete build button with confirmation dialog",
      },
      {
        type: "fix",
        description: "Revalidate browse and builds pages after build deletion",
      },
      {
        type: "fix",
        description: "Fixed helminth augment mod hydration and build codec encoding",
      },
      {
        type: "refactor",
        description:
          "Deduplicated code, removed dead code, and migrated to Prisma 7",
      },
      {
        type: "feat",
        description:
          "Added grid/list view toggle for build lists with author info and dates",
      },
      {
        type: "feat",
        description:
          "Made organization and user names clickable links on build cards",
      },
    ],
  },
  {
    date: "2026-04-11",
    changes: [
      {
        type: "fix",
        description:
          "Improved mod card name readability with darker background and stronger text shadow",
      },
      {
        type: "feat",
        description: "Added format option to screenshot API, default to WebP",
      },
      {
        type: "fix",
        description:
          "Show stats for companions, exalted weapons, and companion weapons",
      },
      {
        type: "chore",
        description: "Updated @wfcd/items to 1.1273.17 (Voruna Prime)",
      },
      {
        type: "fix",
        description:
          "Fixed weapon Overframe import, mod filtering, and Kuva/Tenet capacity",
      },
    ],
  },
  {
    date: "2026-04-10",
    changes: [
      {
        type: "feat",
        description:
          "Added communities tab to admin panel and clickable usernames",
      },
      {
        type: "feat",
        description: "Show helminth augment mods for subsumed abilities",
      },
      {
        type: "fix",
        description: "Set username from GitHub profile on OAuth sign-in",
      },
    ],
  },
  {
    date: "2026-04-09",
    changes: [
      {
        type: "feat",
        description: "Added build screenshot API with API key authentication",
      },
      {
        type: "feat",
        description: "Added API key management tab to admin panel",
      },
    ],
  },
];

const TYPE_LABELS: Record<ChangelogEntry["changes"][number]["type"], string> = {
  feat: "New",
  fix: "Fix",
  refactor: "Improved",
  chore: "Maintenance",
};

const TYPE_COLORS: Record<ChangelogEntry["changes"][number]["type"], string> = {
  feat: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  fix: "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
  refactor: "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900 dark:bg-purple-950/60 dark:text-purple-200",
  chore: "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
};

const TYPE_ORDER: Record<ChangelogEntry["changes"][number]["type"], number> = {
  feat: 0,
  refactor: 1,
  fix: 2,
  chore: 3,
};

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
});

function ChangelogPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="container max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
            <p className="text-muted-foreground text-xl">
              What&apos;s new, fixed, and improved in Arsenyx.
            </p>
          </div>

          <div className="flex flex-col">
            {CHANGELOG.map((entry) => (
              <section
                key={entry.date}
                className="flex flex-col gap-4 border-t py-8 first:border-t-0 first:pt-0"
              >
                <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                  {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
                <ul className="flex flex-col gap-3">
                  {[...entry.changes]
                    .sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
                    .map((change, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex w-24 shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[change.type]}`}
                        >
                          {TYPE_LABELS[change.type]}
                        </span>
                        <span className="text-sm">{change.description}</span>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
