export interface AmpOption {
  value: string
  label: string
}

export const DEFAULT_OPERATOR_AMP = "mote-amp"

/** Modular Amps use the community `prism-scaffold-brace` shorthand (e.g. `5-4-7`). */
const MODULAR_AMP_RE = /^[1-7]-[1-7]-[1-7]$/

export function isModularAmp(value: string | undefined): value is string {
  return value !== undefined && MODULAR_AMP_RE.test(value)
}

/** Validate an untrusted Amp value (share link, saved JSON). */
export function parseOperatorAmp(raw: unknown): string | undefined {
  if (raw === "mote-amp" || raw === "sirocco") return raw
  if (typeof raw === "string" && isModularAmp(raw)) return raw
  return undefined
}

/** The five Focus schools (wiki Module:Focus/data `Schools`). */
export const FOCUS_SCHOOLS: AmpOption[] = [
  { value: "madurai", label: "Madurai" },
  { value: "naramon", label: "Naramon" },
  { value: "unairu", label: "Unairu" },
  { value: "vazarin", label: "Vazarin" },
  { value: "zenurik", label: "Zenurik" },
]

/** Validate an untrusted Focus school value (share link, saved JSON). */
export function parseFocusSchool(raw: unknown): string | undefined {
  return FOCUS_SCHOOLS.some((s) => s.value === raw)
    ? (raw as string)
    : undefined
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
