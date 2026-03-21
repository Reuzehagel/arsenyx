# Build Image Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate shareable 1200x630 PNG build card images via satori + sharp, accessible through the Share dropdown on build pages.

**Architecture:** A GET API route renders a satori-compatible JSX template into SVG, converts to PNG via sharp, and returns the image. The ShareButton component gets "Copy Image" and "Download Image" options that fetch this endpoint.

**Tech Stack:** satori (JSX→SVG), sharp (SVG→PNG), Geist font, Next.js API routes, Bun

**Spec:** `docs/superpowers/specs/2026-03-21-build-image-generation-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/image/build-card.tsx` | Satori-compatible JSX template for the 1200x630 build card |
| `src/lib/image/render.ts` | `renderBuildImage()` — loads font, calls satori + sharp, returns PNG buffer |
| `src/lib/image/font.ts` | Font loading utility — reads Geist .woff file for satori |
| `src/app/api/builds/[slug]/image/route.ts` | GET endpoint — fetch build, render image, return PNG |

### Modified Files
| File | Changes |
|------|---------|
| `next.config.ts` | Add `"sharp"` to `serverExternalPackages` |
| `src/lib/rate-limit.ts` | Add `imageLimiter` |
| `src/components/build/share-button.tsx` | Add `buildSlug` prop, "Copy Image" and "Download Image" menu items |
| `src/app/builds/[slug]/page.tsx` | Pass `build.slug` to ShareButton |

---

## Task 1: Install Dependencies & Config

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install satori and geist**

```bash
bun add satori geist
```

Sharp is already available via Next.js — no install needed.

- [ ] **Step 2: Add sharp to serverExternalPackages**

In `next.config.ts`, update the line:

```typescript
serverExternalPackages: ["pg", "sharp"],
```

- [ ] **Step 3: Verify sharp works**

```bash
node -e "const sharp = require('sharp'); console.log('sharp version:', sharp.versions.sharp)"
```

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock next.config.ts
git commit -m "chore: add satori and geist deps, configure sharp for server"
```

---

## Task 2: Font Loading Utility

**Files:**
- Create: `src/lib/image/font.ts`

- [ ] **Step 1: Find the Geist font file path**

After installing `geist`, the .woff files should be at:
```bash
ls node_modules/geist/dist/fonts/geist-sans/
```

Look for `Geist-Regular.woff` or similar. Note the exact filename.

- [ ] **Step 2: Create font loader**

Create `src/lib/image/font.ts`:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let fontCache: ArrayBuffer | null = null;

/**
 * Load the Geist font as ArrayBuffer for satori.
 * Cached after first load.
 */
export async function loadFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;

  // Geist package provides .woff files
  const fontPath = join(
    process.cwd(),
    "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff"
  );

  const buffer = await readFile(fontPath);
  fontCache = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  return fontCache;
}
```

Note: verify the exact path after install in Step 1. Satori does NOT support `.woff2` — only `.woff`, `.ttf`, and `.otf`. If only `.woff2` is available, use the `.ttf` variant instead.

- [ ] **Step 3: Commit**

```bash
git add src/lib/image/font.ts
git commit -m "feat: add font loading utility for satori image generation"
```

---

## Task 3: Build Card JSX Template

**Files:**
- Create: `src/lib/image/build-card.tsx`

- [ ] **Step 1: Create the satori-compatible template**

Create `src/lib/image/build-card.tsx`. This is a plain function returning JSX (not a React component — satori uses its own renderer). All styles must use inline `style` objects with flexbox.

```tsx
import type { BuildState, PlacedMod, PlacedArcane } from "@/lib/warframe/types";
import { RARITY_CONFIG, type ModRarity } from "@/lib/warframe/mod-card-config";

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: "#09090b",          // zinc-950
  cardBg: "#18181b",      // zinc-900
  border: "#27272a",      // zinc-800
  text: "#fafafa",        // zinc-50
  textMuted: "#a1a1aa",   // zinc-400
  accent: "#3b82f6",      // blue-500
  emptySlot: "#1c1c20",
};

function getRarityBorderColor(rarity?: string): string {
  if (!rarity) return COLORS.border;
  const config = RARITY_CONFIG[rarity as ModRarity];
  return config?.textColor ?? COLORS.border;
}

interface ModCardProps {
  mod: PlacedMod;
}

function ModCard({ mod }: ModCardProps) {
  const borderColor = getRarityBorderColor(mod.rarity);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 6,
        width: 250,
        height: 44,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: borderColor,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {mod.name}
      </span>
      <span
        style={{
          fontSize: 11,
          color: COLORS.textMuted,
          flexShrink: 0,
        }}
      >
        R{mod.rank}
      </span>
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 250,
        height: 44,
        backgroundColor: COLORS.emptySlot,
        border: `1px dashed ${COLORS.border}`,
        borderRadius: 6,
      }}
    >
      <span style={{ fontSize: 12, color: COLORS.border }}>Empty</span>
    </div>
  );
}

function ArcaneCard({ arcane }: { arcane: PlacedArcane }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.accent}`,
        borderRadius: 6,
        height: 40,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: COLORS.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {arcane.name}
      </span>
      <span style={{ fontSize: 11, color: COLORS.textMuted, flexShrink: 0 }}>
        R{arcane.rank}
      </span>
    </div>
  );
}

export interface BuildCardProps {
  buildState: BuildState;
  buildName: string;
  itemName: string;
  authorName: string;
  itemImageSrc?: string; // base64 data URI or null
}

export function BuildCardTemplate({
  buildState,
  buildName,
  itemName,
  authorName,
  itemImageSrc,
}: BuildCardProps) {
  const { normalSlots, auraSlot, exilusSlot, arcaneSlots, formaCount } =
    buildState;

  const arcanes = (arcaneSlots ?? []).filter(
    (a): a is PlacedArcane => a !== null
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: COLORS.bg,
        padding: 32,
        fontFamily: "Geist",
        color: COLORS.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Item image */}
        {itemImageSrc ? (
          <img
            src={itemImageSrc}
            width={64}
            height={64}
            style={{ borderRadius: 8 }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              backgroundColor: COLORS.cardBg,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 24, color: COLORS.border }}>?</span>
          </div>
        )}

        {/* Build info */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {buildName}
          </span>
          <span style={{ fontSize: 14, color: COLORS.textMuted }}>
            {itemName} · by {authorName}
            {formaCount > 0 ? ` · ${formaCount} forma` : ""}
          </span>
        </div>

        {/* Branding */}
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.textMuted,
            letterSpacing: 2,
          }}
        >
          ARSENYX
        </span>
      </div>

      {/* Aura + Exilus row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {auraSlot && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase" }}>
              Aura
            </span>
            {auraSlot.mod ? <ModCard mod={auraSlot.mod} /> : <EmptySlot />}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase" }}>
            Exilus
          </span>
          {exilusSlot?.mod ? <ModCard mod={exilusSlot.mod} /> : <EmptySlot />}
        </div>
      </div>

      {/* Normal mod grid (4x2) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* Row 1: slots 0-3 */}
        <div style={{ display: "flex", gap: 8 }}>
          {normalSlots.slice(0, 4).map((slot, i) =>
            slot.mod ? (
              <ModCard key={i} mod={slot.mod} />
            ) : (
              <EmptySlot key={i} />
            )
          )}
        </div>
        {/* Row 2: slots 4-7 */}
        <div style={{ display: "flex", gap: 8 }}>
          {normalSlots.slice(4, 8).map((slot, i) =>
            slot.mod ? (
              <ModCard key={i + 4} mod={slot.mod} />
            ) : (
              <EmptySlot key={i + 4} />
            )
          )}
        </div>
      </div>

      {/* Arcanes row */}
      {arcanes.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <span
            style={{
              fontSize: 10,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              alignSelf: "center",
              marginRight: 4,
            }}
          >
            Arcanes
          </span>
          {arcanes.map((arcane, i) => (
            <ArcaneCard key={i} arcane={arcane} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Important notes for the implementer:**
- This is NOT a React component for the browser. It's JSX that satori renders.
- All styles MUST be inline `style` objects — no Tailwind, no className.
- Only flexbox layout — no CSS grid.
- `<img>` elements need `src` as a base64 data URI (satori can't fetch URLs).
- The exact layout proportions may need tuning after seeing the first render. The widths (250px per mod card × 4 + gaps = ~1040px) fit within the 1200px - 64px padding.
- **Satori and `key` props:** Satori is not a full React renderer. Remove all `key` props if satori throws or renders them as HTML attributes. If needed, replace `.map()` with explicit elements.
- **Intentional omissions:** Polarity icons and mod images are omitted from V1 for simplicity. Text-only mod cards with rarity-colored borders are the intended approach. These can be added in a future iteration.

- [ ] **Step 2: Commit**

```bash
git add src/lib/image/build-card.tsx
git commit -m "feat: add satori-compatible build card JSX template"
```

---

## Task 4: Image Render Pipeline

**Files:**
- Create: `src/lib/image/render.ts`

- [ ] **Step 1: Create the render function**

Create `src/lib/image/render.ts`:

```typescript
import satori from "satori";
import sharp from "sharp";
import { loadFont } from "./font";
import { BuildCardTemplate, type BuildCardProps } from "./build-card";

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Fetch an image and return as base64 data URI for embedding in satori.
 * Returns undefined if fetch fails.
 */
async function fetchImageAsDataUri(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") ?? "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return undefined;
  }
}

export interface RenderBuildImageInput {
  buildState: BuildCardProps["buildState"];
  buildName: string;
  itemName: string;
  authorName: string;
  itemImageUrl?: string; // CDN URL (will be fetched and converted to base64)
}

/**
 * Render a build card as a PNG buffer.
 */
export async function renderBuildImage(
  input: RenderBuildImageInput
): Promise<Buffer> {
  const [fontData, itemImageSrc] = await Promise.all([
    loadFont(),
    input.itemImageUrl
      ? fetchImageAsDataUri(input.itemImageUrl)
      : Promise.resolve(undefined),
  ]);

  const element = BuildCardTemplate({
    buildState: input.buildState,
    buildName: input.buildName,
    itemName: input.itemName,
    authorName: input.authorName,
    itemImageSrc,
  });

  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      {
        name: "Geist",
        data: fontData,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/image/render.ts
git commit -m "feat: add satori + sharp render pipeline for build images"
```

---

## Task 5: API Route

**Files:**
- Create: `src/app/api/builds/[slug]/image/route.ts`
- Modify: `src/lib/rate-limit.ts`

- [ ] **Step 1: Add image rate limiter**

In `src/lib/rate-limit.ts`, add:

```typescript
/**
 * Image generation rate limiter: 10 images per minute per IP
 */
export const imageLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});
```

- [ ] **Step 2: Create the API route**

Create `src/app/api/builds/[slug]/image/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBuildBySlug } from "@/lib/db/index";
import { renderBuildImage } from "@/lib/image/render";
import { getImageUrl } from "@/lib/warframe/images";
import { imageLimiter, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limit
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await imageLimiter.check(10, ip);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }
    throw e; // re-throw unexpected errors
  }

  const { slug } = await params;

  // Fetch build (no viewerId = public/unlisted only)
  const build = await getBuildBySlug(slug);
  if (!build) {
    return NextResponse.json(
      { error: "Build not found" },
      { status: 404 }
    );
  }

  const authorName =
    build.user.username || build.user.name || "Anonymous";

  const itemImageUrl = build.item.imageName
    ? getImageUrl(build.item.imageName)
    : undefined;

  try {
    const png = await renderBuildImage({
      buildState: build.buildData,
      buildName: build.name,
      itemName: build.item.name,
      authorName,
      itemImageUrl,
    });

    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "Content-Disposition": `inline; filename="${slug}.png"`,
      },
    });
  } catch (err) {
    console.error("Image generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/builds/\\[slug\\]/image/route.ts src/lib/rate-limit.ts
git commit -m "feat: add build image generation API endpoint"
```

---

## Task 6: Update Share Button

**Files:**
- Modify: `src/components/build/share-button.tsx`
- Modify: `src/app/builds/[slug]/page.tsx`

- [ ] **Step 1: Add buildSlug prop and image actions to ShareButton**

Update `src/components/build/share-button.tsx`:

Add `buildSlug` to the props interface:

```typescript
interface ShareButtonProps {
  buildName: string;
  itemName: string;
  buildSlug: string;
}
```

Update the function signature to destructure `buildSlug`:

```typescript
export function ShareButton({ buildName, itemName, buildSlug }: ShareButtonProps) {
```

Add state for loading:

```typescript
const [imageLoading, setImageLoading] = useState(false);
```

Add the `useState` import (alongside `useSyncExternalStore`):

```typescript
import { useState, useSyncExternalStore } from "react";
```

Add these two handler functions (after `nativeShare`):

```typescript
  const fetchImageBlob = async (): Promise<Blob | null> => {
    try {
      setImageLoading(true);
      const res = await fetch(`/api/builds/${buildSlug}/image`);
      if (!res.ok) throw new Error("Failed to generate image");
      return await res.blob();
    } catch {
      toast.error("Failed to generate image");
      return null;
    } finally {
      setImageLoading(false);
    }
  };

  const copyImage = async () => {
    const blob = await fetchImageBlob();
    if (!blob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Image copied!");
    } catch {
      // Fallback: download instead
      downloadBlob(blob);
    }
  };

  const downloadImage = async () => {
    const blob = await fetchImageBlob();
    if (!blob) return;
    downloadBlob(blob);
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${buildName}-${itemName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Image downloaded!");
  };
```

Add the new menu items inside the `DropdownMenuGroup`, after the existing "Share..." item:

```tsx
          <DropdownMenuItem onSelect={copyImage} disabled={imageLoading}>
            <ImageIcon />
            {imageLoading ? "Generating..." : "Copy Image"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={downloadImage} disabled={imageLoading}>
            <Download />
            {imageLoading ? "Generating..." : "Download Image"}
          </DropdownMenuItem>
```

Add the icon imports:

```typescript
import { Link2, Share2, ImageIcon, Download } from "lucide-react";
```

- [ ] **Step 2: Pass buildSlug from the parent page**

In `src/app/builds/[slug]/page.tsx`, find the `<ShareButton` usage and add `buildSlug`:

```tsx
<ShareButton
  buildName={build.name}
  itemName={build.item.name}
  buildSlug={build.slug}
/>
```

- [ ] **Step 3: Run lint**

```bash
bun lint 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/build/share-button.tsx "src/app/builds/[slug]/page.tsx"
git commit -m "feat: add Copy Image and Download Image to share dropdown"
```

---

## Task 7: Smoke Test & Iterate

- [ ] **Step 1: Start dev server**

```bash
bun dev
```

- [ ] **Step 2: Test the API endpoint directly**

Navigate to a build page, note the slug. Then open:
`http://localhost:3000/api/builds/{slug}/image`

Should return a PNG image. Check:
- Image renders with correct dimensions (1200x630)
- Build name, item name, author visible
- Mod cards show with correct names and rarity colors
- Arcanes show if present
- ARSENYX branding visible

- [ ] **Step 3: Test Copy Image**

On a build page, click Share → "Copy Image". Paste into Discord or any image viewer. Verify the image looks correct.

- [ ] **Step 4: Test Download Image**

Click Share → "Download Image". Verify a PNG file downloads with the correct filename.

- [ ] **Step 5: Test edge cases**

- Empty build (no mods) — should show placeholder slots
- Build with long name — should truncate with ellipsis
- Private build — API should return 404
- Rate limiting — rapid requests should return 429 after 10

- [ ] **Step 6: Tune layout if needed**

The template proportions may need adjustment after seeing real renders. Common tweaks:
- Mod card widths (currently 250px)
- Font sizes
- Spacing/padding
- Color choices

Make adjustments in `src/lib/image/build-card.tsx` and iterate.

- [ ] **Step 7: Run lint and tests**

```bash
bun lint
bun test
```

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "fix: tune build card image layout and address edge cases"
```
