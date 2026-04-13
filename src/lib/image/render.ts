import { readFile } from "node:fs/promises"
import { join } from "node:path"

import satori from "satori"
import sharp from "sharp"

import { LRUCache } from "@/lib/lru-cache"
import { getImageUrl } from "@/lib/warframe/images"
import type { BuildState } from "@/lib/warframe/types"

import { BuildCardTemplate } from "./build-card"
import { loadFonts } from "./font"

export const IMAGE_DIMENSIONS = { width: 1200, height: 630 } as const

/**
 * Fetch an image and return as base64 data URI for embedding in satori.
 * Returns undefined if fetch fails.
 */
// Cache fetched image data URIs to avoid re-fetching on repeated renders
const imageDataUriCache = new LRUCache<string, string>(200)

async function fetchImageAsDataUri(url: string): Promise<string | undefined> {
  const cached = imageDataUriCache.get(url)
  if (cached) return cached

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return undefined
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const contentType = res.headers.get("content-type") ?? "image/png"
    const dataUri = `data:${contentType};base64,${base64}`
    imageDataUriCache.set(url, dataUri)
    return dataUri
  } catch {
    return undefined
  }
}

const POLARITY_FILES: Record<string, string> = {
  madurai: "Madurai_Pol.svg",
  vazarin: "Vazarin_Pol.svg",
  naramon: "Naramon_Pol.svg",
  zenurik: "Zenurik_Pol.svg",
  unairu: "Unairu_Pol.svg",
  penjaga: "Penjaga_Pol.svg",
  umbra: "Umbra_Pol.svg",
  any: "Any_Pol.svg",
  universal: "Any_Pol.svg",
}

// Raw SVG strings cached per polarity
let rawSvgCache: Map<string, string> | null = null

/**
 * Load raw SVG strings for all polarity icons.
 */
async function loadRawPolaritySvgs(): Promise<Map<string, string>> {
  if (rawSvgCache) return rawSvgCache

  const map = new Map<string, string>()
  const dir = join(process.cwd(), "public/focus-schools")

  await Promise.all(
    Object.entries(POLARITY_FILES).map(async ([polarity, filename]) => {
      try {
        const buffer = await readFile(join(dir, filename))
        map.set(polarity, buffer.toString("utf-8"))
      } catch {
        // Skip missing files
      }
    }),
  )

  rawSvgCache = map
  return map
}

/**
 * Tint a polarity SVG to a specific color and return as base64 data URI.
 * Replaces fill and stroke colors in the SVG.
 */
const tintCache = new LRUCache<string, string>(100)

function tintSvg(svgString: string, polarity: string, color: string): string {
  const key = `${polarity}:${color}`
  const cached = tintCache.get(key)
  if (cached) return cached

  // Replace existing fill/stroke hex colors
  let tinted = svgString
    .replace(/fill:#[0-9a-fA-F]{6}/g, `fill:${color}`)
    .replace(/stroke:#[0-9a-fA-F]{6}/g, `stroke:${color}`)
  // For SVGs with no explicit fill (like Any_Pol.svg), add fill attribute to <path> elements
  if (!svgString.includes("fill:") && !svgString.includes('fill="')) {
    tinted = tinted.replace(/<path /g, `<path fill="${color}" `)
  }
  const result = `data:image/svg+xml;base64,${Buffer.from(tinted).toString("base64")}`
  tintCache.set(key, result)
  return result
}

export interface PolarityIcons {
  tint: (polarity: string, color: string) => string | undefined
}

/**
 * Collect all unique image URLs from the build state and fetch them in parallel.
 * Returns a Map from CDN URL → base64 data URI.
 */
async function fetchAllImages(
  buildState: BuildState,
  itemImageUrl?: string,
): Promise<Map<string, string>> {
  const urls = new Set<string>()

  if (itemImageUrl) urls.add(itemImageUrl)

  const allSlots = [
    ...buildState.auraSlots,
    buildState.exilusSlot,
    ...buildState.normalSlots,
  ]
  for (const slot of allSlots) {
    if (slot?.mod?.imageName) {
      urls.add(getImageUrl(slot.mod.imageName))
    }
  }

  for (const arcane of buildState.arcaneSlots ?? []) {
    if (arcane?.imageName) {
      urls.add(getImageUrl(arcane.imageName))
    }
  }

  const entries = await Promise.all(
    [...urls].map(async (url) => {
      const dataUri = await fetchImageAsDataUri(url)
      return [url, dataUri] as const
    }),
  )

  const map = new Map<string, string>()
  for (const [url, dataUri] of entries) {
    if (dataUri) map.set(url, dataUri)
  }
  return map
}

export interface RenderBuildImageInput {
  buildState: BuildState
  buildName: string
  itemName: string
  authorName: string
  itemImageUrl?: string
}

/**
 * Render a build card as a PNG buffer.
 */
export async function renderBuildImage(
  input: RenderBuildImageInput,
): Promise<Buffer> {
  const [fonts, imageMap, rawSvgs] = await Promise.all([
    loadFonts(),
    fetchAllImages(input.buildState, input.itemImageUrl),
    loadRawPolaritySvgs(),
  ])

  const polarityIcons: PolarityIcons = {
    tint: (polarity: string, color: string) => {
      const svg = rawSvgs.get(polarity)
      if (!svg) return undefined
      return tintSvg(svg, polarity, color)
    },
  }

  const element = BuildCardTemplate({
    buildState: input.buildState,
    buildName: input.buildName,
    itemName: input.itemName,
    authorName: input.authorName,
    itemImageSrc: input.itemImageUrl
      ? imageMap.get(input.itemImageUrl)
      : undefined,
    imageMap,
    polarityIcons,
  })

  const svg = await satori(element, {
    width: IMAGE_DIMENSIONS.width,
    height: IMAGE_DIMENSIONS.height,
    fonts,
  })

  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return png
}
