import { formatStat } from "@/lib/warframe"

export function round(v: number, digits: number): number {
  const f = Math.pow(10, digits)
  return Math.round(v * f) / f
}

export function formatWithSign(v: number, digits: number, unit = ""): string {
  return `${v >= 0 ? "+" : ""}${formatStat(v, digits)}${unit}`
}
