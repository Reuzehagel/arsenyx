/* PROTOTYPE — issue #331. Variant keys, split out so the switcher and the
 * mount points don't import each other in a cycle. */

export const PROTO_VARIANTS = ["0", "a", "b", "c", "d"] as const
export type ProtoVariant = (typeof PROTO_VARIANTS)[number]

export const PROTO_VARIANT_LABELS: Record<ProtoVariant, string> = {
  "0": "off (baseline)",
  a: "inline card",
  b: "header popover",
  c: "side sheet",
  d: "side sheet + diffs",
}

export function isProtoVariant(v: unknown): v is ProtoVariant {
  return (
    typeof v === "string" && (PROTO_VARIANTS as readonly string[]).includes(v)
  )
}
