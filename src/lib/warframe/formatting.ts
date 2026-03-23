/**
 * Stat Formatting Utilities
 *
 * Centralized formatting functions for stat display across the application.
 * This prevents duplication and ensures consistent formatting.
 */

export type StatFormat = "number" | "percent" | "decimal" | "multiplier"

/**
 * Format a stat value for display with smart rounding
 * Named formatDisplayValue to avoid conflict with shards.ts formatStatValue
 */
export function formatDisplayValue(value: number, format: StatFormat): string {
  switch (format) {
    case "percent":
      // Show as percentage, no trailing zeros
      return value.toFixed(1).replace(/\.0$/, "") + "%"
    case "multiplier":
      // Show with x suffix
      return value.toFixed(1).replace(/\.0$/, "") + "x"
    case "decimal":
      // Show with 2 decimal places, no trailing zeros
      return value.toFixed(2).replace(/\.?0+$/, "")
    case "number":
    default:
      // Floor to integer for most stats (Warframe floors stat values)
      return Math.floor(value).toString()
  }
}

/**
 * Format a contribution value with sign prefix for tooltip display
 */
export function formatContribution(value: number, format: StatFormat): string {
  const sign = value >= 0 ? "+" : ""
  switch (format) {
    case "percent":
      return `${sign}${value.toFixed(1).replace(/\.0$/, "")}%`
    case "multiplier":
      return `${sign}${value.toFixed(1).replace(/\.0$/, "")}x`
    case "decimal":
      return `${sign}${value.toFixed(2).replace(/\.?0+$/, "")}`
    case "number":
    default:
      // Warframe floors stat values
      return `${sign}${Math.floor(value)}`
  }
}

/**
 * Format a percentage value (used for contribution percentages)
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`
}
