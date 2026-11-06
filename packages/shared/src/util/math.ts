/** Constrain `value` to the inclusive `[min, max]` range. Assumes
 *  `min <= max`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
