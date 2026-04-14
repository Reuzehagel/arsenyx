# TODO

## Bugs

- [ ] Add riven mod support to Overframe import

## Performance Audit (Vercel React Best Practices)

### P0 — Eliminating Waterfalls (CRITICAL)

#### Sequential awaits missing `Promise.all`

- [x] `src/app/actions/builds.ts:52-57` — `saveBuildAction` calls `requireAuth()` then `getServerSession()` sequentially (redundant double session fetch)
- [x] `src/lib/db/organizations.ts:213-218` — `removeOrgMember` sequentially awaits two independent Prisma queries
- [x] `src/lib/auth/api-keys.ts:91-100` — `requireApiKey` sequentially awaits rate limit + touch lastUsedAt (independent)
- [x] `src/lib/builds/normalize.ts:610-622` — `normalizeBuildDraftForPersistence` sequentially awaits org resolution + partner build resolution (independent)

#### Cheap sync checks after expensive async

- [x] `src/app/actions/builds.ts:192-198` — `updateBuildGuideAction` awaits auth before cheap length/count checks
- [x] `src/app/actions/organizations.ts:67-81` — `createOrganizationAction` awaits auth + DB before Zod parse
- [x] `src/app/actions/organizations.ts:109-116` — `updateOrganizationAction` — same pattern
- [x] `src/app/actions/api-keys.ts:60-67` — `createApiKeyAction` awaits auth before Zod parse
- [x] `src/app/admin/api-keys/actions.ts:17-29` — `createApiKeyAction` awaits admin before sync validation

#### API route waterfalls

- [x] `src/app/api/v1/builds/[slug]/route.ts:24-56` — PUT: sequential auth -> params -> fetch -> body parse
- [x] `src/app/api/v1/imports/overframe/route.ts:83-100` — POST: sequential auth -> body parse (independent)
- [x] `src/app/api/v1/builds/route.ts:19-25` — POST: sequential auth -> body parse (independent)

#### Missing Suspense boundaries

- [x] `src/app/profile/[username]/page.tsx` — Entire page blocked behind 2 sequential await rounds; builds/stats could stream
- [x] `src/app/org/[slug]/page.tsx` — Page blocked behind org fetch + builds fetch; builds could stream
- [x] `src/app/builds/page.tsx` — Header/filters/tabs blocked behind builds query
- [x] `src/app/favorites/page.tsx` — Page shell blocked behind favorites query
- [x] `src/app/builds/mine/page.tsx` — Page shell blocked behind user builds query

### P0 — Bundle Size (CRITICAL)

#### Barrel imports

- [x] `src/lib/warframe/index.ts` — `export *` from 14 modules; every consumer pulls the entire module graph
- [x] `next.config.ts` — Missing `optimizePackageImports` for `lucide-react` (54 files) and `@/lib/warframe`

#### Missing `next/dynamic`

- [x] `src/components/build/build-guide-section.tsx:26` — `GuideEditor` statically imported; only rendered for build owners inside a dialog
- [x] `src/components/search-command.tsx` — `SearchCommand` statically imported in Header; Cmd+K dialog closed by default on every page
- [x] `src/components/auth/user-menu.tsx:7` — `SettingsSheet` statically imported; only shown on click

#### Conditional loading

- [x] `src/components/build/build-guide-section.tsx:26` — `GuideEditor` loaded for all users, rendered only for owners (`isOwner`)
- [x] `src/components/build-editor/guide-editor.tsx:30` — `PartnerBuildSelector` statically imported, rendered only when `showPartnerBuilds`

### P1 — Server-Side Performance (HIGH)

#### Missing `React.cache()`

- [x] `src/lib/auth.ts:68` — `getServerSession()` not wrapped in `React.cache()`; called multiple times per request

#### Over-serialization to client

- [x] `src/app/builds/[slug]/page.tsx:228-258` — Full WFCD `item` object (abilities, patchlogs, components) serialized to `BuildContainer`; only a subset needed
- [x] `src/app/builds/[slug]/page.tsx:231` — Entire `compatibleMods` array (hundreds of mod objects with drops, levelStats) serialized to client
- [x] `src/app/create/page.tsx` (3 paths) — Same over-serialization across all 3 category code paths

#### Static I/O not hoisted to module level

- [x] `src/lib/image/font.ts:24-47` — Font files read inside function body with manual cache; should be module-level promise
- [x] `src/lib/image/render.ts:59-78` — Polarity SVGs read inside function body; same pattern
- [x] `src/lib/overframe/items-map.ts:52-90` — JSON/CSV file read inside function body

#### Redundant fetches

- [x] `src/app/actions/builds.ts:53-56` — Calls `requireAuth()` then `getServerSession()` again on the next line

### P2 — Client-Side & Re-renders (MEDIUM)

#### Unstable identities breaking memoization

- [x] `src/components/build-editor/build-container.tsx:36` — `compatibleArcanes = []` default creates new array identity every render, flows into useMemo deps
- [x] `src/components/build-editor/build-container.tsx:42` — `initialPartnerBuilds = []` — same pattern
- [x] `src/components/build-editor/build-container.tsx:178` — `partnerBuilds.map(b => b.slug)` inline creates unstable array in hook deps

#### Derived state in effects

- [x] `src/components/mod-card/mod-card.tsx:475-480` — `useEffect` sets `isHovered(false)` when `disableHover` changes; should derive: `isHovered && !disableHover`

#### Non-functional setState

- [x] `src/components/browse/browse-container.tsx:130-140` — `handlePrimeToggle` / `handleVaultedToggle` read state in closure instead of functional form

#### Missing transitions / deferred values

- [x] `src/components/browse/browse-container.tsx:158-161` — Search filtering full item list without `useDeferredValue` (already used in mod/arcane panels but not here)

#### Unversioned localStorage

- [x] `src/components/build-editor/hooks/use-build-persistence.ts:12-13` — `arsenyx_build_` keys store full `BuildState` with no version prefix; schema changes will silently break

### P2 — Rendering & JS Performance (MEDIUM)

#### Combined iterations (multiple passes over arrays)

- [x] `src/lib/warframe/items.ts:188-209` — `filterItems()` chains 4 `.filter()` calls; iterates array up to 4x
- [x] `src/components/build-editor/mod-search-grid.tsx:153-178` — 4 chained `.filter()` calls on mods array
- [x] `src/components/build-editor/stat-breakdown.tsx:27-35` — 4 `.filter()` calls to bucket contributions by source type
- [x] `src/components/build-editor/arcane-search-panel.tsx:65-75` — 2 sequential `.filter()` calls

#### Missing index Maps for repeated lookups

- [x] `src/lib/warframe/helminth.ts:97` — `warframes.find()` inside loop over ~60 abilities; O(n*m)
- [x] `src/lib/warframe/mods.ts:476` — `getModByName()` does linear scan over ~1500 mods (unlike `getModByUniqueName` which uses a Map)
- [x] `src/components/build/build-guide-section.tsx:92` — `availableBuilds.find()` inside `.map()` loop

#### RegExp in hot paths

- [x] `src/lib/warframe/stat-parser.ts:160-247` — 4 regex patterns created inside `parseStatString()` on every call; hot path during stat calculation
- [x] `src/components/build-editor/mod-search-grid.tsx:89` — Regex created inside function called once per mod (~1500 instances)
- [x] `src/components/mod-card/mod-card.tsx:71` — Regex created inside `getModStats()` on every render

#### Missing `content-visibility`

- [x] `src/components/browse/item-grid.tsx:28` — 100+ item cards rendered without `content-visibility: auto`
