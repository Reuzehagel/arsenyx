# shadcn/ui Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all shadcn/ui violations found in the audit: CSS custom properties for game colors, Skeleton for loading states, data-icon for button icons, size-4 for standalone icons, Separator for dividers, and FieldGroup for forms.

**Architecture:** Define game-specific CSS variables in `globals.css` under `@theme inline`, then update all consumer files. All other fixes are mechanical find-and-replace edits. No new files needed beyond the plan.

**Tech Stack:** Tailwind CSS v4 (`@theme inline` for custom vars), shadcn/ui base-nova, React/Next.js

---

## Task 1: Add Warframe CSS custom properties to globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add `wf-*` color variables to the `@theme inline` block**

Append after the existing last entry (`--radius-4xl`) in the `@theme inline` block in `src/app/globals.css`:

```css
  /* Warframe damage type colors */
  --color-wf-impact: oklch(0.707 0.165 254.624);
  --color-wf-puncture: oklch(0.707 0 0);
  --color-wf-slash: oklch(0.704 0.191 22.216);
  --color-wf-heat: oklch(0.75 0.183 55.934);
  --color-wf-cold: oklch(0.789 0.154 211.527);
  --color-wf-electricity: oklch(0.809 0.105 251.813);
  --color-wf-toxin: oklch(0.792 0.209 151.711);
  --color-wf-blast: oklch(0.795 0.184 86.047);
  --color-wf-radiation: oklch(0.879 0.169 91.605);
  --color-wf-gas: oklch(0.897 0.196 126.665);
  --color-wf-magnetic: oklch(0.714 0.203 305.504);
  --color-wf-viral: oklch(0.777 0.152 181.912);
  --color-wf-corrosive: oklch(0.852 0.199 91.936);
  --color-wf-void: oklch(1 0 0);
  --color-wf-tau: oklch(0.865 0.127 207.078);

  /* Warframe mod rarity border colors */
  --color-wf-rarity-common: oklch(0.555 0.163 67.059);
  --color-wf-rarity-uncommon: oklch(0.707 0 0);
  --color-wf-rarity-rare: oklch(0.795 0.184 86.047);
  --color-wf-rarity-legendary: oklch(0.714 0.203 305.504);
  --color-wf-rarity-riven: oklch(0.627 0.265 303.9);
  --color-wf-rarity-amalgam: oklch(0.789 0.154 211.527);
  --color-wf-rarity-galvanized: oklch(0.707 0.165 254.624);

  /* Warframe mod rarity background base colors (use with /90 opacity) */
  --color-wf-rarity-common-bg: oklch(0.279 0.068 65.03);
  --color-wf-rarity-uncommon-bg: oklch(0.269 0 0);
  --color-wf-rarity-rare-bg: oklch(0.249 0.057 83.97);
  --color-wf-rarity-legendary-bg: oklch(0.197 0.063 313.46);
  --color-wf-rarity-amalgam-bg: oklch(0.217 0.06 208.18);
  --color-wf-rarity-galvanized-bg: oklch(0.221 0.097 261.94);

  /* Warframe misc game colors */
  --color-wf-rank-pip: oklch(0.82 0.09 240);
  --color-wf-prime: oklch(0.769 0.183 55.934);
  --color-wf-highlight: oklch(0.828 0.189 84.429);
```

- [ ] **Step 2: Verify build compiles**

```bash
bun build 2>&1 | tail -5
```
Expected: no errors about unknown utilities.

---

## Task 2: Update damage-breakdown.tsx

**Files:**
- Modify: `src/components/build-editor/damage-breakdown.tsx`

- [ ] **Step 1: Replace `DAMAGE_TYPE_COLORS` raw colors with CSS variable classes**

Replace the entire `DAMAGE_TYPE_COLORS` object:

```tsx
const DAMAGE_TYPE_COLORS: Record<DamageType, string> = {
  impact: "text-wf-impact",
  puncture: "text-wf-puncture",
  slash: "text-wf-slash",
  heat: "text-wf-heat",
  cold: "text-wf-cold",
  electricity: "text-wf-electricity",
  toxin: "text-wf-toxin",
  blast: "text-wf-blast",
  radiation: "text-wf-radiation",
  gas: "text-wf-gas",
  magnetic: "text-wf-magnetic",
  viral: "text-wf-viral",
  corrosive: "text-wf-corrosive",
  void: "text-wf-void",
  tau: "text-wf-tau",
}
```

- [ ] **Step 2: Replace `DamageIcon` raw color conditionals with CSS variable classes**

Replace the `DamageIcon` function body:

```tsx
function DamageIcon({ type }: { type: DamageType }) {
  return (
    <div
      className={cn("size-2 rounded-full", {
        "bg-wf-impact": type === "impact",
        "bg-wf-puncture": type === "puncture",
        "bg-wf-slash": type === "slash",
        "bg-wf-heat": type === "heat",
        "bg-wf-cold": type === "cold",
        "bg-wf-electricity": type === "electricity",
        "bg-wf-toxin": type === "toxin",
        "bg-wf-blast": type === "blast",
        "bg-wf-radiation": type === "radiation",
        "bg-wf-gas": type === "gas",
        "bg-wf-magnetic": type === "magnetic",
        "bg-wf-viral": type === "viral",
        "bg-wf-corrosive": type === "corrosive",
        "bg-wf-void": type === "void",
        "bg-wf-tau": type === "tau",
      })}
    />
  )
}
```

---

## Task 3: Update mod-card.tsx

**Files:**
- Modify: `src/components/mod-card/mod-card.tsx`

- [ ] **Step 1: Replace `RARITY_BORDER_MAP` raw color classes**

Replace the entire `RARITY_BORDER_MAP` object (around line 546):

```tsx
const RARITY_BORDER_MAP: Record<ModRarity, string> = {
  Common: "border-wf-rarity-common",
  Uncommon: "border-wf-rarity-uncommon",
  Rare: "border-wf-rarity-rare",
  Legendary: "border-wf-rarity-legendary",
  Peculiar: "border-wf-rarity-legendary",
  Riven: "border-wf-rarity-riven",
  Amalgam: "border-wf-rarity-amalgam",
  Galvanized: "border-wf-rarity-galvanized",
}
```

- [ ] **Step 2: Replace `RARITY_BG_MAP` raw color classes**

Replace the entire `RARITY_BG_MAP` object (around line 557):

```tsx
const RARITY_BG_MAP: Record<ModRarity, string> = {
  Common: "bg-wf-rarity-common-bg/90",
  Uncommon: "bg-wf-rarity-uncommon-bg/90",
  Rare: "bg-wf-rarity-rare-bg/90",
  Legendary: "bg-wf-rarity-legendary-bg/90",
  Peculiar: "bg-wf-rarity-legendary-bg/90",
  Riven: "bg-wf-rarity-legendary-bg/90",
  Amalgam: "bg-wf-rarity-amalgam-bg/90",
  Galvanized: "bg-wf-rarity-galvanized-bg/90",
}
```

- [ ] **Step 3: Replace `border-t border-white/10` with `Separator`**

Add `Separator` import at the top of the file (with other shadcn imports):

```tsx
import { Separator } from "@/components/ui/separator"
```

Then find the set bonus div opening (around line 313):

```tsx
<div className="mt-2 flex w-full flex-col gap-1 border-t border-white/10 pt-1">
```

Replace with (wrap in fragment + Separator):

```tsx
<>
  <Separator className="mt-2" />
  <div className="flex w-full flex-col gap-1 pt-1">
```

And close with `</>` after the closing `</div>` of that block. Locate the closing `</div>` that ends at the set bonus section and wrap with `</>`.

---

## Task 4: Update mod-card-frame.tsx

**Files:**
- Modify: `src/components/mod-card/mod-card-frame.tsx`

- [ ] **Step 1: Replace `bg-[#a8d4ff]` and `bg-gray-800/60` with CSS variable classes**

In the `RankDots` function (around line 118), replace:

```tsx
i < rank ? "bg-[#a8d4ff]" : "bg-gray-800/60",
```

With:

```tsx
i < rank ? "bg-wf-rank-pip" : "bg-muted/60",
```

---

## Task 5: Update stat-breakdown.tsx and browse badge

**Files:**
- Modify: `src/components/build-editor/stat-breakdown.tsx`
- Modify: `src/app/browse/[category]/[slug]/page.tsx`

- [ ] **Step 1: Replace `text-amber-400` in stat-breakdown.tsx**

Find (around line 158):

```tsx
highlight && "text-amber-400",
```

Replace with:

```tsx
highlight && "text-wf-highlight",
```

- [ ] **Step 2: Replace raw Badge color in browse page**

Find (around line 146):

```tsx
<Badge className="bg-amber-500 text-white">Prime</Badge>
```

Replace with:

```tsx
<Badge className="bg-wf-prime text-white">Prime</Badge>
```

---

## Task 6: Fix animate-pulse → Skeleton (5 files)

**Files:**
- Modify: `src/components/auth/user-menu.tsx`
- Modify: `src/components/build/build-guide-section.tsx`
- Modify: `src/components/build-editor/build-editor-guide-section.tsx`
- Modify: `src/components/build-editor/description-editor.tsx`
- Modify: `src/components/build-editor/guide-editor.tsx`

- [ ] **Step 1: Fix user-menu.tsx**

Add Skeleton import to user-menu.tsx:
```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

Replace:
```tsx
return <div className="bg-muted size-8 animate-pulse rounded-full" />
```
With:
```tsx
return <Skeleton className="size-8 rounded-full" />
```

- [ ] **Step 2: Fix build-guide-section.tsx**

Add Skeleton import:
```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

Replace:
```tsx
<div className="bg-muted/30 h-[100px] animate-pulse rounded-md border" />
```
With:
```tsx
<Skeleton className="h-[100px] rounded-md" />
```

- [ ] **Step 3: Fix build-editor-guide-section.tsx**

Add Skeleton import:
```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

Replace both occurrences:
```tsx
<div className="bg-muted/30 h-[200px] animate-pulse rounded-md border" />
```
With:
```tsx
<Skeleton className="h-[200px] rounded-md" />
```
And:
```tsx
<div className="bg-muted/30 h-[100px] animate-pulse rounded-md border" />
```
With:
```tsx
<Skeleton className="h-[100px] rounded-md" />
```

- [ ] **Step 4: Fix description-editor.tsx**

Add Skeleton import:
```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

Replace:
```tsx
<div className="bg-muted/30 h-[200px] animate-pulse rounded-md border" />
```
With:
```tsx
<Skeleton className="h-[200px] rounded-md" />
```

- [ ] **Step 5: Fix guide-editor.tsx**

Add Skeleton import:
```tsx
import { Skeleton } from "@/components/ui/skeleton"
```

Replace:
```tsx
<div className="bg-muted/30 h-[200px] animate-pulse rounded-md border" />
```
With:
```tsx
<Skeleton className="h-[200px] rounded-md" />
```

---

## Task 7: Fix icon sizing in Buttons → data-icon (8 files)

For icons inside `<Button>` with text: add `data-icon="inline-start"`, remove `mr-2` and sizing classes (`h-4 w-4`).
For icons inside `<Button size="icon">` (icon-only): just remove sizing classes.

**Files:**
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/browse/[category]/[slug]/page.tsx`
- Modify: `src/app/guides/[slug]/page.tsx`
- Modify: `src/app/builds/mine/page.tsx`
- Modify: `src/app/guides/[slug]/not-found.tsx`
- Modify: `src/components/build-editor/shard-selection-dialog.tsx`

- [ ] **Step 1: Fix about/page.tsx**

Replace:
```tsx
<Icons.github className="mr-2 h-4 w-4" />
```
With:
```tsx
<Icons.github data-icon="inline-start" />
```

- [ ] **Step 2: Fix browse/[category]/[slug]/page.tsx (2 instances)**

Replace both occurrences of:
```tsx
<Icons.plus className="h-4 w-4" />
```
With:
```tsx
<Icons.plus data-icon="inline-start" />
```
Also remove `className="gap-2"` from the surrounding `<Button>` in each case (the `data-icon` spacing handles the gap).

Actually, keep `className="gap-2"` — the `data-icon` attribute sets `display: contents` on the icon, while the gap is set on the button. Double check: in base-nova, `data-icon` works via CSS so `gap-2` on the button is fine to keep as-is. Remove only the icon's sizing.

- [ ] **Step 3: Fix guides/[slug]/page.tsx (3 instances)**

Replace:
```tsx
<Pencil className="mr-2 h-4 w-4" />
```
With:
```tsx
<Pencil data-icon="inline-start" />
```

Replace:
```tsx
<Share2 className="mr-2 h-4 w-4" />
```
With:
```tsx
<Share2 data-icon="inline-start" />
```

Replace (inside `Button size="icon"` — icon-only, no text):
```tsx
<Copy className="h-4 w-4" />
```
With:
```tsx
<Copy />
```

- [ ] **Step 4: Fix builds/mine/page.tsx**

Replace:
```tsx
<Plus className="mr-2 h-4 w-4" />
```
With:
```tsx
<Plus data-icon="inline-start" />
```

- [ ] **Step 5: Fix guides/[slug]/not-found.tsx (2 instances + 1 standalone)**

Replace both button icons:
```tsx
<ArrowLeft className="h-4 w-4" />
```
With:
```tsx
<ArrowLeft data-icon="inline-start" />
```
```tsx
<BookOpen className="h-4 w-4" />
```
With:
```tsx
<BookOpen data-icon="inline-start" />
```

Also fix the standalone large icon (not inside Button):
```tsx
<FileQuestion className="text-muted-foreground h-8 w-8" />
```
With:
```tsx
<FileQuestion className="text-muted-foreground size-8" />
```

- [ ] **Step 6: Fix shard-selection-dialog.tsx (Button size="icon")**

Replace:
```tsx
<ArrowLeft className="h-4 w-4" />
```
With:
```tsx
<ArrowLeft />
```

---

## Task 8: Fix standalone icon sizing h-4 w-4 → size-4 (12 files)

These icons are NOT inside Button — they're decorative/inline icons in layouts. Replace `h-4 w-4` with `size-4` (and remove `w-4 h-4` pattern too). Preserve all other className content.

**Files:**
- Modify: `src/app/builds/[slug]/page.tsx`
- Modify: `src/app/profile/[username]/page.tsx`
- Modify: `src/app/guides/page.tsx`
- Modify: `src/components/build/build-social-actions.tsx`
- Modify: `src/components/browse/search-bar.tsx`
- Modify: `src/components/guides/guide-header.tsx`
- Modify: `src/components/guides/related-guides.tsx`
- Modify: `src/components/landing/trust-signal.tsx`
- Modify: `src/components/landing/status-badge.tsx`
- Modify: `src/components/footer.tsx`
- Modify: `src/components/build-editor/partner-build-selector.tsx`
- Modify: `src/components/build-editor/publish-dialog.tsx`
- Modify: `src/components/theme-toggle.tsx`

- [ ] **Step 1: Fix builds/[slug]/page.tsx (3 ChevronRight instances)**

Replace each:
```tsx
<ChevronRight className="mx-1 h-4 w-4" />
```
With:
```tsx
<ChevronRight className="mx-1 size-4" />
```

- [ ] **Step 2: Fix profile/[username]/page.tsx**

Replace:
```tsx
<Calendar className="h-4 w-4" />
```
With:
```tsx
<Calendar className="size-4" />
```

- [ ] **Step 3: Fix guides/page.tsx**

Replace:
```tsx
<ExternalLink className="text-muted-foreground h-4 w-4 shrink-0" />
```
With:
```tsx
<ExternalLink className="text-muted-foreground size-4 shrink-0" />
```

- [ ] **Step 4: Fix build-social-actions.tsx**

Replace:
```tsx
<Eye className="h-4 w-4" />
```
With:
```tsx
<Eye className="size-4" />
```

- [ ] **Step 5: Fix search-bar.tsx**

Replace:
```tsx
<Icons.search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
```
With:
```tsx
<Icons.search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
```

- [ ] **Step 6: Fix guide-header.tsx (3 instances)**

Replace:
```tsx
<User className="h-4 w-4" />
```
With:
```tsx
<User className="size-4" />
```

Replace:
```tsx
<Calendar className="h-4 w-4" />
```
With:
```tsx
<Calendar className="size-4" />
```

Replace:
```tsx
<Clock className="h-4 w-4" />
```
With:
```tsx
<Clock className="size-4" />
```

- [ ] **Step 7: Fix related-guides.tsx**

Replace:
```tsx
<ArrowRight className="text-muted-foreground group-hover:text-primary ml-3 h-4 w-4 shrink-0 transition-[transform,color] group-hover:translate-x-0.5" />
```
With:
```tsx
<ArrowRight className="text-muted-foreground group-hover:text-primary ml-3 size-4 shrink-0 transition-[transform,color] group-hover:translate-x-0.5" />
```

- [ ] **Step 8: Fix trust-signal.tsx**

Replace:
```tsx
{Icon && <Icon className="h-4 w-4" />}
```
With:
```tsx
{Icon && <Icon className="size-4" />}
```

- [ ] **Step 9: Fix status-badge.tsx**

Replace:
```tsx
<Icons.zap className="text-warning h-4 w-4" />
```
With:
```tsx
<Icons.zap className="text-warning size-4" />
```

- [ ] **Step 10: Fix footer.tsx**

Replace:
```tsx
<Icons.heart className="text-destructive fill-destructive h-4 w-4" />
```
With:
```tsx
<Icons.heart className="text-destructive fill-destructive size-4" />
```

- [ ] **Step 11: Fix partner-build-selector.tsx**

Replace:
```tsx
<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
```
With:
```tsx
<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
```

- [ ] **Step 12: Fix publish-dialog.tsx**

Replace:
```tsx
<Icon className="h-4 w-4" />
```
With:
```tsx
<Icon className="size-4" />
```

- [ ] **Step 13: Fix theme-toggle.tsx (3 instances)**

Replace:
```tsx
<span className="h-4 w-4" />
```
With:
```tsx
<span className="size-4" />
```

Replace:
```tsx
<Sun className="h-4 w-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
```
With:
```tsx
<Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
```

Replace:
```tsx
<Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
```
With:
```tsx
<Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
```

---

## Task 9: Fix Separator violations (2 files)

**Files:**
- Modify: `src/components/build-editor/conditional-toggle.tsx`
- (mod-card.tsx Separator fix is already covered in Task 3)

- [ ] **Step 1: Fix conditional-toggle.tsx**

Add import at top of file:
```tsx
import { Separator } from "@/components/ui/separator"
```

Replace:
```tsx
<div className="bg-muted/50 flex items-center justify-between gap-2 border-t border-b px-3 py-2">
```
With:
```tsx
<>
  <Separator />
  <div className="bg-muted/50 flex items-center justify-between gap-2 px-3 py-2">
```

And close the fragment after the closing `</div>`:
```tsx
  </div>
  <Separator />
</>
```

The component returns a single JSX element, so the outer `return (...)` wraps the fragment.

---

## Task 10: Fix form layout in import-overframe-client.tsx

**Files:**
- Modify: `src/app/import/import-overframe-client.tsx`

- [ ] **Step 1: Add FieldGroup/Field/FieldLabel imports**

Add to existing imports:
```tsx
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
```

- [ ] **Step 2: Replace raw div+label with FieldGroup+Field+FieldLabel**

Replace:
```tsx
<div className="flex flex-col gap-2">
  <label htmlFor="overframe-url" className="text-sm font-medium">Overframe URL</label>
  <div className="flex flex-col gap-2 sm:flex-row">
```
With:
```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="overframe-url">Overframe URL</FieldLabel>
    <div className="flex flex-col gap-2 sm:flex-row">
```

And close the Field/FieldGroup:
```tsx
    </div>
  </Field>
</FieldGroup>
```

Remove the old closing `</div>` for the `flex flex-col gap-2` wrapper.

---

## Task 11: Final verification

- [ ] **Step 1: Run build**

```bash
bun build 2>&1 | tail -20
```
Expected: Build completes with no TypeScript errors.

- [ ] **Step 2: Run lint**

```bash
bun lint 2>&1 | tail -20
```
Expected: No new lint errors.
