import type { BuildDoc, BuildVariant } from "./build-doc"
import { projectVariant } from "./build-doc"
import { normalizePolarity } from "./mods"
import { RIVEN_IMAGE_NAME, RIVEN_UNIQUE_NAME } from "./rivens"
import { SHARD_COLORS, SHARD_STATS, getStatIndex } from "./shards"
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

// The codec serializes a build to a compact JSON shape, base64'd into a share
// link. Two wire versions exist: v1 (a single loadout, the original format)
// and v2 (multi-variant). Both are produced from, and decoded back into, the
// SAME set of primitives below — there is no per-version copy of the slot /
// shard / incarnon / shared-metadata logic, so the two formats can't drift
// (which is what previously lost `activeIndex` and desynced incarnon state).
// v1 stays the emitted format for single-variant builds to keep those URLs
// short; multi-variant builds emit v2. Decoding accepts both, forever.

function parseLichBonusElement(raw: unknown): LichBonusElement | undefined {
  return typeof raw === "string" &&
    (LICH_BONUS_ELEMENTS as readonly string[]).includes(raw)
    ? (raw as LichBonusElement)
    : undefined
}

declare const Buffer: {
  from(data: string, encoding: string): { toString(encoding: string): string }
}

function toBase64(payload: unknown): string {
  const json = JSON.stringify(payload)
  if (typeof window !== "undefined") return btoa(encodeURIComponent(json))
  return Buffer.from(json, "utf-8").toString("base64")
}

function fromBase64(encoded: string): string {
  if (typeof window !== "undefined") return decodeURIComponent(atob(encoded))
  return Buffer.from(encoded, "base64").toString("utf-8")
}

// =============================================================================
// Wire shapes
// =============================================================================

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

interface EncodedHelminth {
  si: number
  u: string
  n: string
  s: string
  im?: string
  d?: string
}

interface EncodedIncarnon {
  e?: boolean
  p?: (string | null)[]
}

/** The per-loadout slot fields, identical between v1 (top-level) and a v2
 *  variant. */
interface EncodedSlotGroup {
  s: EncodedSlot[]
  a?: EncodedSlot
  A?: EncodedSlot[]
  e?: EncodedSlot
  st?: EncodedSlot
  ar?: EncodedArcane[]
}

/** Build-level metadata shared across every variant, identical between v1 and
 *  v2. */
interface EncodedSharedMeta {
  sh?: number[]
  h?: EncodedHelminth
  zc?: { g: string; l: string }
  lb?: string
  n?: string
}

interface EncodedBuild extends EncodedSlotGroup, EncodedSharedMeta {
  v: 1
  i: string
  c: string
  r: boolean
  ic?: EncodedIncarnon
  dc?: DeploymentContext
}

// v2 intentionally drops `itemName` / `itemImageName` from the payload — the
// receiving client re-fetches them via `itemQuery(category, uniqueName)` when
// rendering, so encoding them would just bloat the URL.
interface EncodedBuildV2 extends EncodedSharedMeta {
  v: 2
  i: string
  c: string
  r: boolean
  ai?: number
  vs: EncodedVariant[]
}

interface EncodedVariant extends EncodedSlotGroup {
  l: string
  id?: string
  ic?: EncodedIncarnon
  dc?: DeploymentContext
  gs?: string
  gd?: string
}

// =============================================================================
// Shared primitives (used by both wire versions)
// =============================================================================

function encodeSlot(slot: ModSlot): EncodedSlot {
  const encoded: EncodedSlot = {}
  if (slot.formaPolarity) encoded.p = slot.formaPolarity
  if (slot.mod) {
    const m: EncodedMod = { u: slot.mod.uniqueName, r: slot.mod.rank }
    if (slot.mod.rivenStats) {
      m.rv = {
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
    encoded.m = m
  }
  return encoded
}

function decodeSlot(
  encoded: EncodedSlot,
  type: "aura" | "exilus" | "stance" | "normal",
  id: string,
): ModSlot {
  const slot: ModSlot = { id, type }
  if (encoded.p) slot.formaPolarity = normalizePolarity(encoded.p)
  if (encoded.m) {
    const isRiven = encoded.m.u === RIVEN_UNIQUE_NAME
    const mod: PlacedMod = {
      uniqueName: encoded.m.u,
      name: isRiven ? "Riven Mod" : "",
      imageName: isRiven ? RIVEN_IMAGE_NAME : undefined,
      polarity: normalizePolarity(encoded.m.rv?.pol),
      baseDrain: encoded.m.rv?.d ?? 0,
      fusionLimit: isRiven ? 8 : 0,
      // Clamp to the absolute in-game rank ceiling. `fusionLimit` is 0 for
      // non-rivens at decode time (we don't have the mod's data here), so it
      // can't gate the rank — a crafted link must not be able to inject an
      // arbitrary rank into capacity / endo math downstream.
      rank: Math.max(0, Math.min(10, Math.floor(encoded.m.r ?? 0))),
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
    const stats = SHARD_STATS[color]
    // Out-of-range stat index (3 bits can address 0-7; colors define 4-5
    // stats) → drop the shard rather than silently snap it to stats[0].
    if (statIndex >= stats.length) return null
    return { color, stat: stats[statIndex].name, tauforged }
  })
}

// Encode whenever the user touched any incarnon field. We deliberately omit
// the enabled flag (`e`) when it's `undefined` (untouched) so the decoder's
// default-on heuristic can apply — and only write it when it was explicitly
// set. Identical for v1 and v2.
function encodeIncarnon(
  enabled: boolean | undefined,
  perks: (string | null)[] | undefined,
): EncodedIncarnon | undefined {
  const hasPickedPerks = perks?.some((p) => p) ?? false
  if (enabled === undefined && !hasPickedPerks) return undefined
  const ic: EncodedIncarnon = {}
  if (enabled !== undefined) ic.e = enabled
  if (hasPickedPerks) ic.p = perks
  return ic
}

function applyIncarnon(
  target: { incarnonEnabled?: boolean; incarnonPerks?: (string | null)[] },
  ic: EncodedIncarnon | undefined,
): void {
  if (!ic) return
  target.incarnonEnabled = ic.e
  target.incarnonPerks = ic.p
}

type SlotGroupSource = Pick<
  BuildVariant,
  "auraSlots" | "exilusSlot" | "stanceSlot" | "normalSlots" | "arcaneSlots"
>

function encodeSlotGroup(target: EncodedSlotGroup, src: SlotGroupSource): void {
  target.s = src.normalSlots.map(encodeSlot)
  if (src.auraSlots.length === 1) target.a = encodeSlot(src.auraSlots[0])
  else if (src.auraSlots.length > 1) target.A = src.auraSlots.map(encodeSlot)
  if (src.exilusSlot?.mod || src.exilusSlot?.formaPolarity)
    target.e = encodeSlot(src.exilusSlot)
  if (src.stanceSlot?.mod || src.stanceSlot?.formaPolarity)
    target.st = encodeSlot(src.stanceSlot)
  const placed = (src.arcaneSlots ?? []).filter(
    (a): a is PlacedArcane => a !== null,
  )
  if (placed.length > 0)
    target.ar = placed.map((a) => ({ u: a.uniqueName, r: a.rank }))
}

function decodeSlotGroup(g: EncodedSlotGroup): SlotGroupSource {
  return {
    auraSlots: g.A
      ? g.A.map((s, i) => decodeSlot(s, "aura", `aura-${i}`))
      : g.a
        ? [decodeSlot(g.a, "aura", "aura-0")]
        : [],
    exilusSlot: g.e ? decodeSlot(g.e, "exilus", "exilus-0") : undefined,
    stanceSlot: g.st ? decodeSlot(g.st, "stance", "stance") : undefined,
    normalSlots: (g.s ?? []).map((s, i) =>
      decodeSlot(s, "normal", `normal-${i}`),
    ),
    arcaneSlots:
      g.ar && g.ar.length > 0
        ? g.ar.map((a) => ({
            uniqueName: a.u,
            name: "",
            rank: a.r,
            rarity: "",
          }))
        : [],
  }
}

type SharedMetaSource = Pick<
  BuildDoc,
  | "shardSlots"
  | "helminthAbility"
  | "zawComponents"
  | "lichBonusElement"
  | "buildName"
>

function encodeSharedMeta(
  target: EncodedSharedMeta,
  src: SharedMetaSource,
): void {
  if (
    src.shardSlots &&
    src.shardSlots.length > 0 &&
    src.shardSlots.some((s) => s !== null)
  )
    target.sh = encodeShards(src.shardSlots)
  if (src.helminthAbility) {
    target.h = {
      si: src.helminthAbility.slotIndex,
      u: src.helminthAbility.ability.uniqueName,
      n: src.helminthAbility.ability.name,
      s: src.helminthAbility.ability.source,
      im: src.helminthAbility.ability.imageName,
      d: src.helminthAbility.ability.description,
    }
  }
  if (src.zawComponents)
    target.zc = { g: src.zawComponents.grip, l: src.zawComponents.link }
  if (src.lichBonusElement) target.lb = src.lichBonusElement
  if (src.buildName) target.n = src.buildName
}

function decodeSharedMeta(encoded: EncodedSharedMeta): SharedMetaSource & {
  shardSlots: (PlacedShard | null)[]
} {
  return {
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
  }
}

// =============================================================================
// v1 — single loadout (BuildState)
// =============================================================================

export function encodeBuild(state: BuildState): string {
  const encoded: EncodedBuild = {
    v: 1,
    i: state.itemUniqueName,
    c: state.itemCategory,
    r: state.hasReactor,
    s: [],
  }
  encodeSlotGroup(encoded, state)
  encodeSharedMeta(encoded, state)
  const ic = encodeIncarnon(state.incarnonEnabled, state.incarnonPerks)
  if (ic) encoded.ic = ic
  if (
    state.deploymentContext &&
    state.deploymentContext !== DEFAULT_DEPLOYMENT_CONTEXT
  )
    encoded.dc = state.deploymentContext
  return toBase64(encoded)
}

export function decodeBuild(base64String: string): Partial<BuildState> | null {
  try {
    const encoded: EncodedBuild = JSON.parse(fromBase64(base64String))
    if (encoded.v !== 1) return null
    const state: Partial<BuildState> = {
      itemUniqueName: encoded.i,
      itemCategory: encoded.c as BrowseCategory,
      hasReactor: encoded.r,
      ...decodeSlotGroup(encoded),
      ...decodeSharedMeta(encoded),
    }
    applyIncarnon(state, encoded.ic)
    if (encoded.dc) state.deploymentContext = encoded.dc
    return state
  } catch {
    return null
  }
}

// =============================================================================
// v2 — multi-variant share links
// =============================================================================

function encodeVariant(v: BuildVariant): EncodedVariant {
  const ev: EncodedVariant = { l: v.label, id: v.id, s: [] }
  encodeSlotGroup(ev, v)
  const ic = encodeIncarnon(v.incarnonEnabled, v.incarnonPerks)
  if (ic) ev.ic = ic
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
    ...decodeSlotGroup(ev),
  }
  applyIncarnon(variant, ev.ic)
  if (ev.dc) variant.deploymentContext = ev.dc
  if (ev.gs) variant.guideSummary = ev.gs
  if (ev.gd) variant.guideDescription = ev.gd
  return variant
}

/**
 * Encode a `BuildDoc` for a share link. Single-variant docs round-trip through
 * the v1 encoder so existing URLs / outside consumers see no change.
 * Multi-variant docs emit v2.
 */
export function encodeBuildDoc(doc: BuildDoc, activeIndex = 0): string {
  if (doc.variants.length === 1) {
    return encodeBuild(projectVariant(doc, 0))
  }
  const encoded: EncodedBuildV2 = {
    v: 2,
    i: doc.itemUniqueName,
    c: doc.itemCategory,
    r: doc.hasReactor,
    vs: doc.variants.map(encodeVariant),
  }
  encodeSharedMeta(encoded, doc)
  const ai = Math.floor(activeIndex)
  if (Number.isFinite(ai) && ai > 0) encoded.ai = ai
  return toBase64(encoded)
}

/**
 * Decode a share link to a `BuildDoc`. Accepts both v1 (wrapped as a
 * single-variant doc) and v2. Returns `null` on parse failure or an
 * unsupported version, matching `decodeBuild`'s tolerant contract.
 */
export function decodeBuildDoc(base64String: string): BuildDoc | null {
  try {
    const raw = JSON.parse(fromBase64(base64String)) as { v?: number }
    if (raw.v === 1) {
      const v1 = decodeBuild(base64String)
      return v1 ? buildStateToBuildDoc(v1) : null
    }
    if (raw.v === 2) return decodeV2(raw as unknown as EncodedBuildV2)
    return null
  } catch {
    return null
  }
}

function decodeV2(encoded: EncodedBuildV2): BuildDoc {
  const doc: BuildDoc = {
    itemUniqueName: encoded.i,
    itemCategory: encoded.c as BrowseCategory,
    itemName: "",
    hasReactor: encoded.r,
    ...decodeSharedMeta(encoded),
    variants: encoded.vs.map(decodeVariant),
  }
  if (typeof encoded.ai === "number") {
    const ai = Math.floor(encoded.ai)
    if (Number.isFinite(ai) && ai > 0) {
      doc.activeIndex = Math.min(ai, doc.variants.length - 1)
    }
  }
  return doc
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

// =============================================================================
// URL helpers
// =============================================================================

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
