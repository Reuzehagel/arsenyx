import satori from "satori";
import sharp from "sharp";
import { loadFonts } from "./font";
import { BuildCardTemplate } from "./build-card";
import { getImageUrl } from "@/lib/warframe/images";
import type { BuildState } from "@/lib/warframe/types";

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

/**
 * Collect all unique image URLs from the build state and fetch them in parallel.
 * Returns a Map from CDN URL → base64 data URI.
 */
async function fetchAllImages(
  buildState: BuildState,
  itemImageUrl?: string
): Promise<Map<string, string>> {
  const urls = new Set<string>();

  if (itemImageUrl) urls.add(itemImageUrl);

  // Mod images
  const allSlots = [
    buildState.auraSlot,
    buildState.exilusSlot,
    ...buildState.normalSlots,
  ];
  for (const slot of allSlots) {
    if (slot?.mod?.imageName) {
      urls.add(getImageUrl(slot.mod.imageName));
    }
  }

  // Arcane images
  for (const arcane of buildState.arcaneSlots ?? []) {
    if (arcane?.imageName) {
      urls.add(getImageUrl(arcane.imageName));
    }
  }

  // Fetch all in parallel
  const entries = await Promise.all(
    [...urls].map(async (url) => {
      const dataUri = await fetchImageAsDataUri(url);
      return [url, dataUri] as const;
    })
  );

  const map = new Map<string, string>();
  for (const [url, dataUri] of entries) {
    if (dataUri) map.set(url, dataUri);
  }
  return map;
}

export interface RenderBuildImageInput {
  buildState: BuildState;
  buildName: string;
  itemName: string;
  authorName: string;
  itemImageUrl?: string;
}

/**
 * Render a build card as a PNG buffer.
 */
export async function renderBuildImage(
  input: RenderBuildImageInput
): Promise<Buffer> {
  const [fonts, imageMap] = await Promise.all([
    loadFonts(),
    fetchAllImages(input.buildState, input.itemImageUrl),
  ]);

  const element = BuildCardTemplate({
    buildState: input.buildState,
    buildName: input.buildName,
    itemName: input.itemName,
    authorName: input.authorName,
    itemImageSrc: input.itemImageUrl
      ? imageMap.get(input.itemImageUrl)
      : undefined,
    imageMap,
  });

  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}
