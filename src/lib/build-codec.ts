// Build encoding/decoding utilities
// Encodes builds to shareable base64 URLs and decodes them back

import { SHARD_COLORS, getStatIndex, getStatByIndex } from "./warframe/shards"
import { RIVEN_UNIQUE_NAME, RIVEN_IMAGE_NAME } from "./warframe/rivens"
import type {
  BuildState,
  ModSlot,
  Polarity,
  BrowseCategory,
  PlacedShard,
  PlacedArcane,
  RivenStats,
} from "./warframe/types"

const VALID_POLARITIES = new Set<string>([
  "madurai", "vazarin", "naramon", "zenurik", "unairu", "penjaga", "umbra", "any", "universal",
])

// =============================================================================
// BUILD ENCODING
// =============================================================================

interface EncodedBuild {
  v: number // Version for forward compatibility
  i: string // Item unique name
  c: string // Category
  r: boolean // Has reactor/catalyst
  a?: EncodedSlot // Legacy: single aura slot
  A?: EncodedSlot[] // Aura slots array (v1 extension)
  e?: EncodedSlot // Exilus slot
  s: EncodedSlot[] // Normal slots (8)
  ar?: EncodedArcane[] // Arcane slots (2)
  sh?: number[] // Shard slots (5) - encoded as numbers
  n?: string // Build name
  h?: EncodedHelminth // Helminth ability
}

interface EncodedHelminth {
  si: number // Replaced ability slot
  u: string // Unique name
  n: string // Name
  s: string // Source warframe
  im?: string // Image name
  d?: string // Description
}

interface EncodedSlot {
  p?: string // Forma polarity (if different from innate)
  m?: EncodedMod // Placed mod
}

interface EncodedMod {
  u: string // Unique name
  r: number // Rank
  rv?: {
    p: { s: string; v: number }[] // Positive stats
    n: { s: string; v: number }[] // Negative stats
    d: number // Drain
    pol: string // Polarity
  }
}

interface EncodedArcane {
  u: string // Unique name
  r: number // Rank
}

/**
 * Encode a build state to a base64 string for sharing
 */
export function encodeBuild(state: BuildState): string {
  const encoded: EncodedBuild = {
    v: 1,
    i: state.itemUniqueName,
    c: state.itemCategory,
    r: state.hasReactor,
    s: state.normalSlots.map(encodeSlot),
  }

  // Aura slots
  if (state.auraSlots.length === 1) {
    // Single aura slot: use legacy field for backward compat
    encoded.a = encodeSlot(state.auraSlots[0])
  } else if (state.auraSlots.length > 1) {
    encoded.A = state.auraSlots.map(encodeSlot)
  }

  if (state.exilusSlot?.mod || state.exilusSlot?.formaPolarity) {
    encoded.e = encodeSlot(state.exilusSlot)
  }

  if (state.arcaneSlots?.length > 0) {
    const placedArcanes = state.arcaneSlots.filter(
      (a): a is PlacedArcane => a !== null,
    )

    if (placedArcanes.length > 0) {
      encoded.ar = placedArcanes.map((a) => ({ u: a.uniqueName, r: a.rank }))
    }
  }

  // Encode shards (warframes only)
  if (
    state.shardSlots?.length > 0 &&
    state.shardSlots.some((s) => s !== null)
  ) {
    encoded.sh = encodeShards(state.shardSlots)
  }

  if (state.helminthAbility) {
    encoded.h = {
      si: state.helminthAbility.slotIndex,
      u: state.helminthAbility.ability.uniqueName,
      n: state.helminthAbility.ability.name,
      s: state.helminthAbility.ability.source,
      im: state.helminthAbility.ability.imageName,
      d: state.helminthAbility.ability.description,
    }
  }

  if (state.buildName) {
    encoded.n = state.buildName
  }

  // Encode to base64
  const jsonString = JSON.stringify(encoded)

  // Use browser-safe base64 encoding
  if (typeof window !== "undefined") {
    return btoa(encodeURIComponent(jsonString))
  }

  // Node.js environment
  return Buffer.from(jsonString, "utf-8").toString("base64")
}

function encodeSlot(slot: ModSlot): EncodedSlot {
  const encoded: EncodedSlot = {}

  if (slot.formaPolarity) {
    encoded.p = slot.formaPolarity
  }

  if (slot.mod) {
    const encodedMod: EncodedMod = {
      u: slot.mod.uniqueName,
      r: slot.mod.rank,
    }

    if (slot.mod.rivenStats) {
      encodedMod.rv = {
        p: slot.mod.rivenStats.positives.map((s) => ({ s: s.stat, v: s.value })),
        n: slot.mod.rivenStats.negatives.map((s) => ({ s: s.stat, v: s.value })),
        d: slot.mod.baseDrain,
        pol: slot.mod.polarity,
      }
    }

    encoded.m = encodedMod
  }

  return encoded
}

/**
 * Encode shards to a compact number array
 * Format per slot: 0 = empty, or (colorIndex << 4) | (statIndex << 1) | tauforged
 */
function encodeShards(shards: (PlacedShard | null)[]): number[] {
  return shards.map((shard) => {
    if (!shard) return 0
    const colorIndex = SHARD_COLORS.indexOf(shard.color) + 1 // 1-5
    const statIndex = getStatIndex(shard.color, shard.stat) // 0-3
    return (colorIndex << 4) | (statIndex << 1) | (shard.tauforged ? 1 : 0)
  })
}

/**
 * Decode shards from a number array
 */
function decodeShards(encoded: number[]): (PlacedShard | null)[] {
  return encoded.map((byte) => {
    if (byte === 0) return null
    const colorIndex = (byte >> 4) - 1 // 0-4
    const statIndex = (byte >> 1) & 0x7 // 0-7 (using 3 bits)
    const tauforged = (byte & 1) === 1

    if (colorIndex < 0 || colorIndex >= SHARD_COLORS.length) return null

    const color = SHARD_COLORS[colorIndex]
    const stat = getStatByIndex(color, statIndex)

    return {
      color,
      stat,
      tauforged,
    }
  })
}

// =============================================================================
// BUILD DECODING
// =============================================================================

/**
 * Decode a base64 string back to a partial build state
 * Returns null if decoding fails
 */
export function decodeBuild(base64String: string): Partial<BuildState> | null {
  try {
    // Decode from base64
    let jsonString: string

    if (typeof window !== "undefined") {
      jsonString = decodeURIComponent(atob(base64String))
    } else {
      jsonString = Buffer.from(base64String, "base64").toString("utf-8")
    }

    const encoded: EncodedBuild = JSON.parse(jsonString)

    // Validate version
    if (encoded.v !== 1) {
      console.warn(`Unknown build version: ${encoded.v}`)
      return null
    }

    // Convert back to BuildState
    const state: Partial<BuildState> = {
      itemUniqueName: encoded.i,
      itemCategory: encoded.c as BrowseCategory,
      hasReactor: encoded.r,
      buildName: encoded.n,
    }

    // Decode aura slots
    if (encoded.A) {
      state.auraSlots = encoded.A.map((s, i) =>
        decodeSlot(s, "aura", `aura-${i}`),
      )
    } else if (encoded.a) {
      state.auraSlots = [decodeSlot(encoded.a, "aura", "aura-0")]
    }

    // Decode exilus slot
    if (encoded.e) {
      state.exilusSlot = decodeSlot(encoded.e, "exilus", "exilus-0")
    }

    // Decode normal slots
    if (encoded.s) {
      state.normalSlots = encoded.s.map((s, i) =>
        decodeSlot(s, "normal", `normal-${i}`),
      )
    }

    // Decode arcanes
    if (encoded.ar && encoded.ar.length > 0) {
      state.arcaneSlots = encoded.ar.map((a) => ({
        uniqueName: a.u,
        name: "", // Will be filled by the loader
        rank: a.r,
        rarity: "",
      }))
    }

    // Decode shards
    if (encoded.sh) {
      state.shardSlots = decodeShards(encoded.sh)
    }

    // Decode helminth ability
    if (encoded.h) {
      state.helminthAbility = {
        slotIndex: encoded.h.si,
        ability: {
          uniqueName: encoded.h.u,
          name: encoded.h.n,
          source: encoded.h.s,
          imageName: encoded.h.im,
          description: encoded.h.d,
        },
      }
    }

    return state
  } catch (error) {
    console.error("Failed to decode build:", error)
    return null
  }
}

function decodeSlot(
  encoded: EncodedSlot,
  type: "aura" | "exilus" | "normal",
  id: string,
): ModSlot {
  const slot: ModSlot = {
    id,
    type,
  }

  if (encoded.p) {
    slot.formaPolarity = encoded.p as Polarity
  }

  if (encoded.m) {
    const isRiven = encoded.m.u === RIVEN_UNIQUE_NAME
    const rawPolarity = encoded.m.rv?.pol ?? "universal"
    const mod: import("./warframe/types").PlacedMod = {
      uniqueName: encoded.m.u,
      name: isRiven ? "Riven Mod" : "",
      imageName: isRiven ? RIVEN_IMAGE_NAME : undefined,
      polarity: (VALID_POLARITIES.has(rawPolarity) ? rawPolarity : "universal") as Polarity,
      baseDrain: encoded.m.rv?.d ?? 0,
      fusionLimit: isRiven ? 8 : 0,
      rank: encoded.m.r,
      rarity: isRiven ? "Riven" : "",
    }

    if (encoded.m.rv) {
      mod.rivenStats = {
        positives: encoded.m.rv.p.map((s) => ({ stat: s.s, value: s.v })),
        negatives: encoded.m.rv.n.map((s) => ({ stat: s.s, value: s.v })),
      }
    }

    slot.mod = mod
  }

  return slot
}

// =============================================================================
// URL UTILITIES
// =============================================================================

/**
 * Generate a shareable URL for a build
 */
export function generateBuildUrl(state: BuildState, baseUrl?: string): string {
  const encoded = encodeBuild(state)
  const base =
    baseUrl || (typeof window !== "undefined" ? window.location.origin : "")

  return `${base}/create?build=${encodeURIComponent(encoded)}`
}

/**
 * Extract build data from a URL
 */
export function extractBuildFromUrl(url: string): Partial<BuildState> | null {
  try {
    const urlObj = new URL(url)
    const buildParam = urlObj.searchParams.get("build")

    if (!buildParam) return null

    return decodeBuild(decodeURIComponent(buildParam))
  } catch {
    return null
  }
}

/**
 * Copy build URL to clipboard
 */
export async function copyBuildToClipboard(
  state: BuildState,
): Promise<boolean> {
  try {
    const url = generateBuildUrl(state)
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    return false
  }
}
