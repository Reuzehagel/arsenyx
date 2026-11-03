/**
 * Operator name → wiki File basename, overriding the `Image` field of
 * `Module:Warframes/data` Operators rows.
 *
 * The Operator row names `Operator.png`, which doesn't exist on the wiki
 * (the Operator page's infobox uses `OperatorBust.png`), so the image resolver
 * finds nothing and the browse card falls back to a placeholder. Drop an entry
 * once the wiki module points at a real file.
 */
export const OPERATOR_IMAGE_FIXES: Record<string, string> = {
  Operator: "OperatorBust.png",
}
