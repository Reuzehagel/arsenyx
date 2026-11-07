/** Trim trailing zeros; integers render without a decimal point. */
export function formatStat(v: number, digits = 2): string {
  return Number.isInteger(v)
    ? v.toString()
    : parseFloat(v.toFixed(digits)).toString()
}

/** `0.155` → `"15.5%"`. `undefined` passes through. */
export function formatPct(
  v: number | undefined,
  digits = 1,
): string | undefined {
  if (v === undefined) return undefined
  return `${(v * 100).toFixed(digits)}%`
}
