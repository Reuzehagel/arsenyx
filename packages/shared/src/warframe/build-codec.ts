import type { BuildDoc, BuildVariant } from "./build-doc"
import { normalizePolarity } from "./mods"
import { RIVEN_IMAGE_NAME, RIVEN_UNIQUE_NAME } from "./rivens"
import { SHARD_COLORS, getStatByIndex, getStatIndex } from "./shards"
import { DEFAULT_DEPLOYMENT_CONTEXT, LICH_BONUS_ELEMENTS } from "./types"
import type {
  BrowseCategory,
  BuildState,
  DeploymentContext,
  LichBonusElement,
  ModSlot,
  PlacedArcane,
  PlacedMod,
  PlacedShard,
} from "./types"

function parseLichBonusElement(raw: unknown): LichBonusElement | undefined {
  return typeof raw === "string" &&
    (LICH_BONUS_ELEMENTS as readonly string[]).includes(raw)
    ? (raw as LichBonusElement)
    : undefined
}

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
  st?: EncodedSlot
  s: EncodedSlot[]
  ar?: EncodedArcane[]
  sh?: number[]
  n?: string
  h?: EncodedHelminth
  zc?: { g: string; l: string }
  lb?: string
  ic?: { e: boolean; p?: (string | null)[] }
  dc?: DeploymentContext
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

  if (state.stanceSlot?.mod || state.stanceSlot?.formaPolarity) {
    encoded.st = encodeSlot(state.stanceSlot)
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

  if (state.lichBonusElement) {
    encoded.lb = state.lichBonusElement
  }

  // Encode whenever the user touched any incarnon field. Encoding only on
  // truthy values would lose "explicitly disabled" for innate incarnons,
  // since the decoder re-applies a default-on heuristic when the field is
  // missing.
  const hasPickedPerks = state.incarnonPerks?.some((p) => p) ?? false
  if (state.incarnonEnabled !== undefined || hasPickedPerks) {
    encoded.ic = { e: state.incarnonEnabled ?? false }
    if (hasPickedPerks) encoded.ic.p = state.incarnonPerks
  }

  if (
    state.deploymentContext &&
    state.deploymentContext !== DEFAULT_DEPLOYMENT_CONTEXT
  ) {
    encoded.dc = state.deploymentContext
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

    if (encoded.st) {
      state.stanceSlot = decodeSlot(encoded.st, "stance", "stance")
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

    const lb = parseLichBonusElement(encoded.lb)
    if (lb) state.lichBonusElement = lb

    if (encoded.ic) {
      state.incarnonEnabled = encoded.ic.e
      state.incarnonPerks = encoded.ic.p
    }

    if (encoded.dc) {
      state.deploymentContext = encoded.dc
    }

    return state
  } catch {
    return null
  }
}

function decodeSlot(
  encoded: EncodedSlot,
  type: "aura" | "exilus" | "stance" | "normal",
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

// =============================================================================
// V2 — multi-variant share links
// =============================================================================

// v2 intentionally drops `itemName` / `itemImageName` from the payload — the
// receiving client re-fetches them via `itemQuery(category, uniqueName)`
// when rendering, so encoding them would just bloat the URL. v1 carried
// them (`state.itemName`) for the same reason — also unused on decode.
interface EncodedBuildV2 {
  v: 2
  i: string
  c: string
  r: boolean
  sh?: number[]
  h?: EncodedHelminth
  zc?: { g: string; l: string }
  lb?: string
  n?: string
  ai?: number
  vs: EncodedVariant[]
}

interface EncodedVariant {
  l: string
  id?: string
  a?: EncodedSlot
  A?: EncodedSlot[]
  e?: EncodedSlot
  st?: EncodedSlot
  s: EncodedSlot[]
  ar?: EncodedArcane[]
  ic?: { e?: boolean; p?: (string | null)[] }
  dc?: DeploymentContext
  gs?: string
  gd?: string
}

function encodeVariant(v: BuildVariant): EncodedVariant {
  const ev: EncodedVariant = {
    l: v.label,
    id: v.id,
    s: v.normalSlots.map(encodeSlot),
  }
  if (v.auraSlots.length === 1) ev.a = encodeSlot(v.auraSlots[0])
  else if (v.auraSlots.length > 1) ev.A = v.auraSlots.map(encodeSlot)
  if (v.exilusSlot?.mod || v.exilusSlot?.formaPolarity)
    ev.e = encodeSlot(v.exilusSlot)
  if (v.stanceSlot?.mod || v.stanceSlot?.formaPolarity)
    ev.st = encodeSlot(v.stanceSlot)
  const placedArcanes = (v.arcaneSlots ?? []).filter(
    (a): a is PlacedArcane => a !== null,
  )
  if (placedArcanes.length > 0) {
    ev.ar = placedArcanes.map((a) => ({ u: a.uniqueName, r: a.rank }))
  }
  const hasPickedPerks = v.incarnonPerks?.some((p) => p) ?? false
  if (v.incarnonEnabled !== undefined || hasPickedPerks) {
    ev.ic = {}
    if (v.incarnonEnabled !== undefined) ev.ic.e = v.incarnonEnabled
    if (hasPickedPerks) ev.ic.p = v.incarnonPerks
  }
  if (v.deploymentContext && v.deploymentContext !== DEFAULT_DEPLOYMENT_CONTEXT)
    ev.dc = v.deploymentContext
  if (v.guideSummary) ev.gs = v.guideSummary
  if (v.guideDescription) ev.gd = v.guideDescription
  return ev
}

function decodeVariant(ev: EncodedVariant, index: number): BuildVariant {
  const variant: BuildVariant = {
    id: ev.id ?? `v${index}`,
    label: ev.l,
    auraSlots: ev.A
      ? ev.A.map((s, i) => decodeSlot(s, "aura", `aura-${i}`))
      : ev.a
        ? [decodeSlot(ev.a, "aura", "aura-0")]
        : [],
    exilusSlot: ev.e ? decodeSlot(ev.e, "exilus", "exilus-0") : undefined,
    stanceSlot: ev.st ? decodeSlot(ev.st, "stance", "stance") : undefined,
    normalSlots: ev.s.map((s, i) => decodeSlot(s, "normal", `normal-${i}`)),
    arcaneSlots:
      ev.ar && ev.ar.length > 0
        ? ev.ar.map((a) => ({
            uniqueName: a.u,
            name: "",
            rank: a.r,
            rarity: "",
          }))
        : [],
  }
  if (ev.ic) {
    variant.incarnonEnabled = ev.ic.e
    variant.incarnonPerks = ev.ic.p
  }
  if (ev.dc) variant.deploymentContext = ev.dc
  if (ev.gs) variant.guideSummary = ev.gs
  if (ev.gd) variant.guideDescription = ev.gd
  return variant
}

/**
 * Encode a `BuildDoc` for a share link. Single-variant docs round-trip
 * through the v1 encoder so existing URLs / outside consumers see no
 * change. Multi-variant docs emit v2.
 */
export function encodeBuildDoc(doc: BuildDoc, activeIndex = 0): string {
  if (doc.variants.length === 1) {
    return encodeBuild(buildDocToBuildState(doc, 0))
  }
  const encoded: EncodedBuildV2 = {
    v: 2,
    i: doc.itemUniqueName,
    c: doc.itemCategory,
    r: doc.hasReactor,
    vs: doc.variants.map(encodeVariant),
  }
  if (doc.shardSlots?.length > 0 && doc.shardSlots.some((s) => s !== null))
    encoded.sh = encodeShards(doc.shardSlots)
  if (doc.helminthAbility) {
    encoded.h = {
      si: doc.helminthAbility.slotIndex,
      u: doc.helminthAbility.ability.uniqueName,
      n: doc.helminthAbility.ability.name,
      s: doc.helminthAbility.ability.source,
      im: doc.helminthAbility.ability.imageName,
      d: doc.helminthAbility.ability.description,
    }
  }
  if (doc.zawComponents) {
    encoded.zc = { g: doc.zawComponents.grip, l: doc.zawComponents.link }
  }
  if (doc.lichBonusElement) encoded.lb = doc.lichBonusElement
  if (doc.buildName) encoded.n = doc.buildName
  if (activeIndex > 0) encoded.ai = activeIndex

  const jsonString = JSON.stringify(encoded)
  if (typeof window !== "undefined") {
    return btoa(encodeURIComponent(jsonString))
  }
  return Buffer.from(jsonString, "utf-8").toString("base64")
}

/**
 * Decode a share link to a `BuildDoc`. Accepts both v1 (wrapped as a
 * single-variant doc) and v2. Returns `null` on parse failure or an
 * unsupported version, matching `decodeBuild`'s tolerant contract.
 */
export function decodeBuildDoc(base64String: string): BuildDoc | null {
  try {
    let jsonString: string
    if (typeof window !== "undefined") {
      jsonString = decodeURIComponent(atob(base64String))
    } else {
      jsonString = Buffer.from(base64String, "base64").toString("utf-8")
    }
    const raw = JSON.parse(jsonString) as { v?: number }
    if (raw.v === 1) {
      const v1 = decodeBuild(base64String)
      if (!v1) return null
      return buildStateToBuildDoc(v1)
    }
    if (raw.v === 2) return decodeV2(raw as unknown as EncodedBuildV2)
    return null
  } catch {
    return null
  }
}

function decodeV2(encoded: EncodedBuildV2): BuildDoc {
  return {
    itemUniqueName: encoded.i,
    itemCategory: encoded.c as BrowseCategory,
    itemName: "",
    hasReactor: encoded.r,
    shardSlots: encoded.sh ? decodeShards(encoded.sh) : [],
    helminthAbility: encoded.h
      ? {
          slotIndex: encoded.h.si,
          ability: {
            uniqueName: encoded.h.u,
            name: encoded.h.n,
            source: encoded.h.s,
            imageName: encoded.h.im,
            description: encoded.h.d,
          },
        }
      : undefined,
    zawComponents: encoded.zc
      ? { grip: encoded.zc.g, link: encoded.zc.l }
      : undefined,
    lichBonusElement: parseLichBonusElement(encoded.lb),
    buildName: encoded.n,
    variants: encoded.vs.map(decodeVariant),
  }
}

function buildDocToBuildState(doc: BuildDoc, index: number): BuildState {
  const v = doc.variants[index]
  return {
    itemUniqueName: doc.itemUniqueName,
    itemName: doc.itemName,
    itemCategory: doc.itemCategory,
    itemImageName: doc.itemImageName,
    hasReactor: doc.hasReactor,
    shardSlots: doc.shardSlots,
    helminthAbility: doc.helminthAbility,
    zawComponents: doc.zawComponents,
    lichBonusElement: doc.lichBonusElement,
    buildName: doc.buildName,
    auraSlots: v.auraSlots,
    exilusSlot: v.exilusSlot,
    stanceSlot: v.stanceSlot,
    normalSlots: v.normalSlots,
    arcaneSlots: v.arcaneSlots,
    incarnonEnabled: v.incarnonEnabled,
    incarnonPerks: v.incarnonPerks,
    deploymentContext: v.deploymentContext,
    baseCapacity: 0,
    currentCapacity: 0,
    formaCount: 0,
  }
}

function buildStateToBuildDoc(state: Partial<BuildState>): BuildDoc {
  return {
    itemUniqueName: state.itemUniqueName ?? "",
    itemName: state.itemName ?? "",
    itemCategory: (state.itemCategory ?? "warframes") as BrowseCategory,
    itemImageName: state.itemImageName,
    hasReactor: state.hasReactor ?? false,
    shardSlots: state.shardSlots ?? [],
    helminthAbility: state.helminthAbility,
    zawComponents: state.zawComponents,
    lichBonusElement: state.lichBonusElement,
    buildName: state.buildName,
    variants: [
      {
        id: "v0",
        label: "Main",
        auraSlots: state.auraSlots ?? [],
        exilusSlot: state.exilusSlot,
        stanceSlot: state.stanceSlot,
        normalSlots: state.normalSlots ?? [],
        arcaneSlots: state.arcaneSlots ?? [],
        incarnonEnabled: state.incarnonEnabled,
        incarnonPerks: state.incarnonPerks,
        deploymentContext: state.deploymentContext,
      },
    ],
  }
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
