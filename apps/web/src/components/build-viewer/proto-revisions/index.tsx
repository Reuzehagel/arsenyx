import { VariantA } from "./variant-a"
import { VariantBTrigger } from "./variant-b"
import { VariantCTrigger } from "./variant-c"
import type { ProtoVariant } from "./variants"

/* PROTOTYPE HARNESS — issue #331 (build edit history / "version list").
 *
 * Question: where does the edit log live on a build page, and how loud is it?
 * Four states on the existing /builds/$slug route via `?variant=`:
 *
 *   0 — off (baseline, the page as it ships today)
 *   a — always-on card between the header and the loadout
 *   b — popover hung off the header's existing "Updated 2d ago" text
 *   c — right-hand sheet opened from a "History" button in the header
 *   d — the same sheet, with a per-revision +/- diff
 *
 * Read-only, dev-only, fed by a fixed stub (./stub-data.ts) — there is no
 * BuildRevision table yet. Delete this whole folder when the question is
 * answered; see the three `PROTOTYPE` markers in builds.$slug.tsx,
 * build-viewer-body.tsx and viewer-header.tsx for the wiring to unpick.
 */

/** Slot between ViewerHeader and the loadout. */
export function ProtoRevisionsBelowHeader({
  variant,
}: {
  variant: ProtoVariant | undefined
}) {
  return variant === "a" ? <VariantA /> : null
}

/** Replaces the header's plain "Updated …" timestamp when variant B is active;
 *  returns null otherwise so the header falls back to its real markup. */
export function ProtoRevisionsTimestamp({
  variant,
  updatedAt,
}: {
  variant: ProtoVariant | undefined
  updatedAt: string
}) {
  return variant === "b" ? <VariantBTrigger updatedAt={updatedAt} /> : null
}

/** Slot in the header's action row (next to Edit). */
export function ProtoRevisionsHeaderAction({
  variant,
}: {
  variant: ProtoVariant | undefined
}) {
  if (variant === "c") return <VariantCTrigger />
  if (variant === "d") return <VariantCTrigger showDiff />
  return null
}

export { PrototypeSwitcher } from "./prototype-switcher"
export {
  isProtoVariant,
  PROTO_VARIANT_LABELS,
  PROTO_VARIANTS,
  type ProtoVariant,
} from "./variants"
