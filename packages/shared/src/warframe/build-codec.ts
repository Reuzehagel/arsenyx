import { normalizePolarity } from "./mods"
import { RIVEN_IMAGE_NAME, RIVEN_UNIQUE_NAME } from "./rivens"
import { SHARD_COLORS, getStatByIndex, getStatIndex } from "./shards"
import type {
  BrowseCategory,
  BuildState,
  ModSlot,
  PlacedArcane,
  PlacedMod,
  PlacedShard,
} from "./types"

declare const Buffer: {
  from(data: string, encoding: string): { toString(encoding: string): string }
}

interface EncodedBuild {
  v: number
  i: string
  c: string
  r: boolean
  a?: EncodedSlot
  A?: EncodedSlot[]
  e?: EncodedSlot
  s: EncodedSlot[]
  ar?: EncodedArcane[]
  sh?: number[]
  n?: string
  h?: EncodedHelminth
  zc?: { g: string; l: string }
}

interface EncodedHelminth {
  si: number
  u: string
  n: string
  s: string
  im?: string
  d?: string
}

interface EncodedSlot {
  p?: string
  m?: EncodedMod
}

interface EncodedMod {
  u: string
  r: number
  rv?: {
    p: { s: string; v: number }[]
    n: { s: string; v: number }[]
    d: number
    pol: string
  }
}

interface EncodedArcane {
  u: string
  r: number
}

export function encodeBuild(state: BuildState): string {
  const encoded: EncodedBuild = {
    v: 1,
    i: state.itemUniqueName,
    c: state.itemCategory,
    r: state.hasReactor,
    s: state.normalSlots.map(encodeSlot),
  }

  if (state.auraSlots.length === 1) {
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

  if (state.zawComponents) {
    encoded.zc = {
      g: state.zawComponents.grip,
      l: state.zawComponents.link,
    }
  }

  const jsonString = JSON.stringify(encoded)

  if (typeof window !== "undefined") {
    return btoa(encodeURIComponent(jsonString))
  }
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
        p: slot.mod.rivenStats.positives.map((s) => ({
          s: s.stat,
          v: s.value,
        })),
        n: slot.mod.rivenStats.negatives.map((s) => ({
          s: s.stat,
          v: s.value,
        })),
        d: slot.mod.baseDrain,
        pol: slot.mod.polarity,
      }
    }

    encoded.m = encodedMod
  }

  return encoded
}

// Per slot: 0 = empty, or (colorIndex << 4) | (statIndex << 1) | tauforged
function encodeShards(shards: (PlacedShard | null)[]): number[] {
  return shards.map((shard) => {
    if (!shard) return 0
    const colorIndex = SHARD_COLORS.indexOf(shard.color) + 1
    const statIndex = getStatIndex(shard.color, shard.stat)
    return (colorIndex << 4) | (statIndex << 1) | (shard.tauforged ? 1 : 0)
  })
}

function decodeShards(encoded: number[]): (PlacedShard | null)[] {
  return encoded.map((byte) => {
    if (byte === 0) return null
    const colorIndex = (byte >> 4) - 1
    const statIndex = (byte >> 1) & 0x7
    const tauforged = (byte & 1) === 1

    if (colorIndex < 0 || colorIndex >= SHARD_COLORS.length) return null

    const color = SHARD_COLORS[colorIndex]
    const stat = getStatByIndex(color, statIndex)

    return { color, stat, tauforged }
  })
}

export function decodeBuild(base64String: string): Partial<BuildState> | null {
  try {
    let jsonString: string

    if (typeof window !== "undefined") {
      jsonString = decodeURIComponent(atob(base64String))
    } else {
      jsonString = Buffer.from(base64String, "base64").toString("utf-8")
    }

    const encoded: EncodedBuild = JSON.parse(jsonString)

    if (encoded.v !== 1) return null

    const state: Partial<BuildState> = {
      itemUniqueName: encoded.i,
      itemCategory: encoded.c as BrowseCategory,
      hasReactor: encoded.r,
      buildName: encoded.n,
    }

    if (encoded.A) {
      state.auraSlots = encoded.A.map((s, i) =>
        decodeSlot(s, "aura", `aura-${i}`),
      )
    } else if (encoded.a) {
      state.auraSlots = [decodeSlot(encoded.a, "aura", "aura-0")]
    }

    if (encoded.e) {
      state.exilusSlot = decodeSlot(encoded.e, "exilus", "exilus-0")
    }

    if (encoded.s) {
      state.normalSlots = encoded.s.map((s, i) =>
        decodeSlot(s, "normal", `normal-${i}`),
      )
    }

    if (encoded.ar && encoded.ar.length > 0) {
      state.arcaneSlots = encoded.ar.map((a) => ({
        uniqueName: a.u,
        name: "",
        rank: a.r,
        rarity: "",
      }))
    }

    if (encoded.sh) {
      state.shardSlots = decodeShards(encoded.sh)
    }

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

    if (encoded.zc) {
      state.zawComponents = {
        grip: encoded.zc.g,
        link: encoded.zc.l,
      }
    }

    return state
  } catch {
    return null
  }
}

function decodeSlot(
  encoded: EncodedSlot,
  type: "aura" | "exilus" | "normal",
  id: string,
): ModSlot {
  const slot: ModSlot = { id, type }

  if (encoded.p) {
    slot.formaPolarity = normalizePolarity(encoded.p)
  }

  if (encoded.m) {
    const isRiven = encoded.m.u === RIVEN_UNIQUE_NAME
    const mod: PlacedMod = {
      uniqueName: encoded.m.u,
      name: isRiven ? "Riven Mod" : "",
      imageName: isRiven ? RIVEN_IMAGE_NAME : undefined,
      polarity: normalizePolarity(encoded.m.rv?.pol),
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

export function generateBuildUrl(state: BuildState, baseUrl?: string): string {
  const encoded = encodeBuild(state)
  const base =
    baseUrl || (typeof window !== "undefined" ? window.location.origin : "")
  return `${base}/create?build=${encodeURIComponent(encoded)}`
}

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
