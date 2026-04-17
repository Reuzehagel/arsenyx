import {
  Keyboard,
  Upload,
  Users,
  ChartSpline,
  Github,
  Heart,
  Plus,
  Search,
  Bell,
  Settings,
  User,
  ArrowRight,
  ExternalLink,
  Zap,
  Command,
  Crosshair,
  Target,
  Swords,
  Bot,
  PawPrint,
  Shield,
  ChevronLeft,
  Filter,
  ArrowUpDown,
  type LucideIcon,
} from "lucide-react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import type { Polarity } from "@/lib/warframe/types"

export type Icon = LucideIcon

// Icon size variants for consistent sizing across the app
export const iconSizes = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
} as const

export type IconSize = keyof typeof iconSizes

// Helper to get icon class with size
export function getIconClass(size: IconSize = "sm", className?: string) {
  return cn(iconSizes[size], className)
}

export const Icons = {
  keyboard: Keyboard,
  upload: Upload,
  users: Users,
  chartSpline: ChartSpline,
  github: Github,
  heart: Heart,
  plus: Plus,
  search: Search,
  bell: Bell,
  settings: Settings,
  user: User,
  arrowRight: ArrowRight,
  externalLink: ExternalLink,
  zap: Zap,
  command: Command,
  crosshair: Crosshair,
  target: Target,
  swords: Swords,
  bot: Bot,
  pawPrint: PawPrint,
  shield: Shield,
  chevronLeft: ChevronLeft,
  filter: Filter,
  arrowUpDown: ArrowUpDown,
}

// =============================================================================
// POLARITY ICON COMPONENT
// =============================================================================

const polaritySvgMap: Record<Polarity, string> = {
  madurai: "/focus-schools/Madurai_Pol.svg",
  vazarin: "/focus-schools/Vazarin_Pol.svg",
  naramon: "/focus-schools/Naramon_Pol.svg",
  zenurik: "/focus-schools/Zenurik_Pol.svg",
  unairu: "/focus-schools/Unairu_Pol.svg",
  penjaga: "/focus-schools/Penjaga_Pol.svg",
  umbra: "/focus-schools/Umbra_Pol.svg",
  any: "/focus-schools/Any_Pol.svg",
  universal: "/focus-schools/Any_Pol.svg",
}

const polarityColorMap: Record<Polarity, string> = {
  madurai: "brightness-0 invert sepia saturate-[10] hue-rotate-[350deg]", // Orange
  vazarin: "brightness-0 invert sepia saturate-[10] hue-rotate-[180deg]", // Blue
  naramon: "brightness-0 invert sepia saturate-[10] hue-rotate-[85deg]", // Green
  zenurik: "brightness-0 invert sepia saturate-[10] hue-rotate-[15deg]", // Yellow
  unairu: "brightness-0 invert sepia saturate-[10] hue-rotate-[250deg]", // Purple
  penjaga: "brightness-0 invert sepia saturate-[10] hue-rotate-[150deg]", // Cyan
  umbra: "brightness-0 invert sepia saturate-[10] hue-rotate-[25deg]", // Amber
  any: "brightness-0 invert opacity-60", // Gray
  universal: "brightness-0 invert opacity-60", // Gray
}

interface PolarityIconProps {
  polarity: Polarity
  size?: IconSize
  className?: string
  colored?: boolean
}

export function PolarityIcon({
  polarity,
  size = "sm",
  className,
  colored = false,
}: PolarityIconProps) {
  const sizeClasses = iconSizes[size]
  const svgPath = polaritySvgMap[polarity]

  return (
    <div className={cn("relative", sizeClasses, className)}>
      <Image
        src={svgPath}
        alt={`${polarity} polarity`}
        fill
        unoptimized
        className={cn(
          "object-contain",
          colored ? polarityColorMap[polarity] : "brightness-0 invert",
        )}
      />
    </div>
  )
}
