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

import { cn } from "@/lib/utils"

export type Icon = LucideIcon

export const iconSizes = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
} as const

export type IconSize = keyof typeof iconSizes

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
