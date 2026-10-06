export interface AmpOption {
  value: string
  label: string
}

export const OPERATOR_AMP_TYPES: AmpOption[] = [
  { value: "mote-amp", label: "Mote Amp" },
  { value: "sirocco", label: "Sirocco" },
  { value: "custom", label: "Modular Amp" },
]

export const AMP_PRISMS: AmpOption[] = [
  { value: "1", label: "1 · Raplak" },
  { value: "2", label: "2 · Shwaak" },
  { value: "3", label: "3 · Granmu" },
  { value: "4", label: "4 · Rahn" },
  { value: "5", label: "5 · Cantic" },
  { value: "6", label: "6 · Lega" },
  { value: "7", label: "7 · Klamora" },
]

export const AMP_SCAFFOLDS: AmpOption[] = [
  { value: "1", label: "1 · Pencha" },
  { value: "2", label: "2 · Shraksun" },
  { value: "3", label: "3 · Klebrik" },
  { value: "4", label: "4 · Phahd" },
  { value: "5", label: "5 · Exard" },
  { value: "6", label: "6 · Dissic" },
  { value: "7", label: "7 · Propa" },
]

export const AMP_BRACES: AmpOption[] = [
  { value: "1", label: "1 · Clapkra" },
  { value: "2", label: "2 · Juttni" },
  { value: "3", label: "3 · Lohrin" },
  { value: "4", label: "4 · Anspatha" },
  { value: "5", label: "5 · Suo" },
  { value: "6", label: "6 · Plaga" },
  { value: "7", label: "7 · Certus" },
]
