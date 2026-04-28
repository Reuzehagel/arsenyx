// Lightweight incarnon lookups: names + genesis adapter images + variant
// stripping. The full evolution trees live in incarnon-evolutions.ts (only
// imported by the build script) and are fetched on demand from
// /data/incarnon-evolutions.json — see apps/web/src/lib/incarnon-query.ts.

export type { IncarnonEvolution, IncarnonPerk, IncarnonTier } from "./incarnon-evolutions"

/** Stable identifier for the incarnon-form alt-fire attack mode in WFCD data. */
export const INCARNON_FORM_ATTACK_NAME = "Incarnon Form"

/** All 48 incarnon-eligible base weapon names (8 innate + 40 Steel Path). */
export const INCARNON_NAMES: ReadonlySet<string> = new Set([
  "Ack & Brunt",
  "Angstrum",
  "Anku",
  "Atomos",
  "Bo",
  "Boar",
  "Boltor",
  "Braton",
  "Bronco",
  "Burston",
  "Ceramic Dagger",
  "Cestra",
  "Dera",
  "Despair",
  "Dread",
  "Dual Ichor",
  "Dual Toxocyst",
  "Felarx",
  "Furax",
  "Furis",
  "Gammacor",
  "Gorgon",
  "Hate",
  "Innodem",
  "Kunai",
  "Laetum",
  "Lato",
  "Latron",
  "Lex",
  "Magistar",
  "Miter",
  "Nami Solo",
  "Okina",
  "Onos",
  "Paris",
  "Phenmor",
  "Praedos",
  "Ruvox",
  "Sibear",
  "Sicarus",
  "Skana",
  "Soma",
  "Strun",
  "Sybaris",
  "Thalys",
  "Torid",
  "Vasto",
  "Zylok",
])

/**
 * Genesis adapter icons keyed by base weapon name (Steel Path Circuit weapons
 * only — innate incarnons aren't included).
 */
export const INCARNON_GENESIS_IMAGES: Readonly<Record<string, string>> = {
  "Ack & Brunt": "ack-&-brunt-incarnon-genesis-60193158a5.png",
  "Angstrum": "angstrum-incarnon-genesis-c193a62744.png",
  "Anku": "anku-incarnon-genesis-2f1e9f5da5.png",
  "Atomos": "atomos-incarnon-genesis-8e653f4129.png",
  "Bo": "bo-incarnon-genesis-4ed74cbfe6.png",
  "Boar": "boar-incarnon-genesis-dc5057673e.png",
  "Boltor": "boltor-incarnon-genesis-48cb27d044.png",
  "Braton": "braton-incarnon-genesis-6e1b9f2706.png",
  "Bronco": "bronco-incarnon-genesis-30aedff429.png",
  "Burston": "burston-incarnon-genesis-3bd03393ef.png",
  "Ceramic Dagger": "ceramic-dagger-incarnon-genesis-96b24632f3.png",
  "Cestra": "cestra-incarnon-genesis-afa2e5eded.png",
  "Dera": "dera-incarnon-genesis-8e5a4b4202.png",
  "Despair": "despair-incarnon-genesis-3edd9f35c5.png",
  "Dread": "dread-incarnon-genesis-f426f4836e.png",
  "Dual Ichor": "dual-ichor-incarnon-genesis-88ae97cf2c.png",
  "Dual Toxocyst": "dual-toxocyst-incarnon-genesis-232806645f.png",
  "Furax": "furax-incarnon-genesis-f7733b9520.png",
  "Furis": "furis-incarnon-genesis-0619c9b272.png",
  "Gammacor": "gammacor-incarnon-genesis-d780652d4e.png",
  "Gorgon": "gorgon-incarnon-genesis-6b6d3afc74.png",
  "Hate": "hate-incarnon-genesis-d4a9290beb.png",
  "Kunai": "kunai-incarnon-genesis-4d96c8fa08.png",
  "Lato": "lato-incarnon-genesis-e6b8e7103a.png",
  "Latron": "latron-incarnon-genesis-fdb0e32d10.png",
  "Lex": "lex-incarnon-genesis-1b0f6c93ca.png",
  "Magistar": "magistar-incarnon-genesis-f7effb894e.png",
  "Miter": "miter-incarnon-genesis-0132066e5b.png",
  "Nami Solo": "nami-solo-incarnon-genesis-cb63f8bd81.png",
  "Okina": "okina-incarnon-genesis-b577797b58.png",
  "Paris": "paris-incarnon-genesis-fc565f73ce.png",
  "Sibear": "sibear-incarnon-genesis-4bd3c74fbe.png",
  "Sicarus": "sicarus-incarnon-genesis-d76130686e.png",
  "Skana": "skana-incarnon-genesis-f7b7beb3d7.png",
  "Soma": "soma-incarnon-genesis-980f2c3695.png",
  "Strun": "strun-incarnon-genesis-dd91e0dde3.png",
  "Sybaris": "sybaris-incarnon-genesis-6e569b3afa.png",
  "Torid": "torid-incarnon-genesis-ac933e5824.png",
  "Vasto": "vasto-incarnon-genesis-d46bbc3760.png",
  "Zylok": "zylok-incarnon-genesis-8a778d911c.png",
}

// Variant prefixes/suffixes stripped before lookup. Order matters — strip
// longest/most-specific first so e.g. "Mk1-Furis" → "Furis" not "k1-Furis".
const VARIANT_PREFIXES = [
  "Mk1-",
  "MK1-",
  "Telos ",
  "Mara ",
  "Rakta ",
  "Synoid ",
  "Sancti ",
  "Vaykor ",
  "Secura ",
  "Carmine ",
  "Prisma ",
  "Dex ",
  "Kuva ",
  "Tenet ",
] as const

const VARIANT_SUFFIXES = [" Prime", " Wraith", " Vandal"] as const

function stripVariant(name: string): string {
  let n = name
  for (const p of VARIANT_PREFIXES) {
    if (n.startsWith(p)) {
      n = n.slice(p.length)
      break
    }
  }
  for (const s of VARIANT_SUFFIXES) {
    if (n.endsWith(s)) {
      n = n.slice(0, -s.length)
      break
    }
  }
  return n
}

/** Resolves a WFCD weapon name (incl. variants) to its base incarnon key, or null. */
export function getIncarnonBaseName(weaponName: string): string | null {
  if (INCARNON_NAMES.has(weaponName)) return weaponName
  const stripped = stripVariant(weaponName)
  return INCARNON_NAMES.has(stripped) ? stripped : null
}

export function hasIncarnon(weaponName: string): boolean {
  return getIncarnonBaseName(weaponName) !== null
}

export function getIncarnonGenesisImage(weaponName: string): string | null {
  const base = getIncarnonBaseName(weaponName)
  if (!base) return null
  return INCARNON_GENESIS_IMAGES[base] ?? null
}

/** True for innate incarnons (Felarx, Phenmor, Laetum, …) — no separate adapter. */
export function isInnateIncarnon(weaponName: string): boolean {
  const base = getIncarnonBaseName(weaponName)
  return base !== null && !INCARNON_GENESIS_IMAGES[base]
}

