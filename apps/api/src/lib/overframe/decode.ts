import type { OverframeDecodedSlot, OverframeSlotType } from "./types"

export interface DecodedBuild {
  slots: OverframeDecodedSlot[]
  raw: unknown
}

function decodeBase64ToUtf8(input: string): string {
  // Handle base64url variants
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padLen = (4 - (normalized.length % 4)) % 4
  const padded = normalized + "=".repeat(padLen)
  return Buffer.from(padded, "base64").toString("utf8")
}

function coerceSlotArray(
  raw: unknown,
): Array<{ id: string; rank: number }> | null {
  // Overframe buildstring formats vary. This tries a few likely structures.
  // Accepted shapes:
  // - [{id: "5924", rank: 10}, ...]
  // - [["5924", 10], ...]
  // - { slots: [...] }
  if (!raw) return null

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const maybeSlots = (raw as Record<string, unknown>).slots
    if (maybeSlots) return coerceSlotArray(maybeSlots)
  }

  if (!Array.isArray(raw)) return null

  const out: Array<{ id: string; rank: number }> = []

  for (const entry of raw) {
    if (!entry) continue
    if (Array.isArray(entry) && entry.length >= 2) {
      const id = String(entry[0])
      const rank = Number(entry[1])
      if (id && Number.isFinite(rank)) out.push({ id, rank })
      continue
    }

    if (typeof entry === "object") {
      const obj = entry as Record<string, unknown>
      const idVal = obj.id ?? obj.modId ?? obj.itemId ?? obj["0"] // last resort
      const rankVal = obj.rank ?? obj.level ?? obj["1"]
      if (idVal === undefined || rankVal === undefined) continue
      const id = String(idVal)
      const rank = Number(rankVal)
      if (id && Number.isFinite(rank)) out.push({ id, rank })
      continue
    }
  }

  return out.length > 0 ? out : null
}

function assignSlotTypes(
  slots: Array<{ id: string; rank: number }>,
): OverframeDecodedSlot[] {
  // Heuristic mapping:
  // - 10 entries: aura, exilus, 8 normal
  // - 9 entries: exilus, 8 normal
  // - 8 entries: 8 normal
  // Anything else: treat as normal sequential.
  const decoded: OverframeDecodedSlot[] = []

  const make = (
    overframeId: string,
    rank: number,
    slotType: OverframeSlotType,
    slotIndex: number,
  ) => ({ overframeId, rank, slotType, slotIndex })

  if (slots.length === 10) {
    decoded.push(make(slots[0].id, slots[0].rank, "aura", 0))
    decoded.push(make(slots[1].id, slots[1].rank, "exilus", 0))
    for (let i = 2; i < 10; i++)
      decoded.push(make(slots[i].id, slots[i].rank, "normal", i - 2))
    return decoded
  }

  if (slots.length === 9) {
    decoded.push(make(slots[0].id, slots[0].rank, "exilus", 0))
    for (let i = 1; i < 9; i++)
      decoded.push(make(slots[i].id, slots[i].rank, "normal", i - 1))
    return decoded
  }

  if (slots.length === 8) {
    for (let i = 0; i < 8; i++)
      decoded.push(make(slots[i].id, slots[i].rank, "normal", i))
    return decoded
  }

  for (let i = 0; i < slots.length; i++) {
    decoded.push(make(slots[i].id, slots[i].rank, "normal", i))
  }
  return decoded
}

export function decodeOverframeBuildString(buildString: string): DecodedBuild {
  // Try base64 -> utf8 -> JSON
  const text = decodeBase64ToUtf8(buildString)

  let raw: unknown = text
  try {
    raw = JSON.parse(text)
  } catch {
    // Some formats may be JSON embedded in a string; try one more layer.
    try {
      const trimmed = text.trim()
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        raw = JSON.parse(JSON.parse(trimmed))
      }
    } catch {
      // Leave raw as text.
    }
  }

  const coerced = coerceSlotArray(raw)
  if (!coerced) {
    return { slots: [], raw }
  }

  return { slots: assignSlotTypes(coerced), raw }
}
