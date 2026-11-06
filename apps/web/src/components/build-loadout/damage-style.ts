// Presentation for damage types: Tailwind tokens (see the `wf-*` colours in
// the theme) and the in-game damage glyphs under public/icons/damage/.

import type { DamageType } from "@/lib/stats/types"

export const DAMAGE_TYPE_STYLE: Record<
  DamageType,
  { text: string; bg: string }
> = {
  impact: { text: "text-wf-impact", bg: "bg-wf-impact" },
  puncture: { text: "text-wf-puncture", bg: "bg-wf-puncture" },
  slash: { text: "text-wf-slash", bg: "bg-wf-slash" },
  heat: { text: "text-wf-heat", bg: "bg-wf-heat" },
  cold: { text: "text-wf-cold", bg: "bg-wf-cold" },
  electricity: { text: "text-wf-electricity", bg: "bg-wf-electricity" },
  toxin: { text: "text-wf-toxin", bg: "bg-wf-toxin" },
  blast: { text: "text-wf-blast", bg: "bg-wf-blast" },
  radiation: { text: "text-wf-radiation", bg: "bg-wf-radiation" },
  gas: { text: "text-wf-gas", bg: "bg-wf-gas" },
  magnetic: { text: "text-wf-magnetic", bg: "bg-wf-magnetic" },
  viral: { text: "text-wf-viral", bg: "bg-wf-viral" },
  corrosive: { text: "text-wf-corrosive", bg: "bg-wf-corrosive" },
  void: { text: "text-wf-void", bg: "bg-wf-void" },
  tau: { text: "text-wf-tau", bg: "bg-wf-tau" },
}

export const DAMAGE_TYPE_ICON: Partial<Record<DamageType, string>> = {
  impact: "/icons/damage/ImpactSymbol.png",
  puncture: "/icons/damage/PunctureSymbol.png",
  slash: "/icons/damage/SlashSymbol.png",
  heat: "/icons/damage/HeatSymbol.png",
  cold: "/icons/damage/ColdSymbol.png",
  electricity: "/icons/damage/ElectricitySymbol.png",
  toxin: "/icons/damage/ToxinSymbol.png",
  blast: "/icons/damage/BlastSymbol.png",
  radiation: "/icons/damage/RadiationSymbol.png",
  gas: "/icons/damage/GasSymbol.png",
  magnetic: "/icons/damage/MagneticSymbol.png",
  viral: "/icons/damage/ViralSymbol.png",
  corrosive: "/icons/damage/CorrosiveSymbol.png",
}
