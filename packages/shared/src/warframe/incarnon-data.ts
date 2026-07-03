// Lightweight incarnon lookups: names + genesis adapter images + variant
// stripping. The full evolution trees live in incarnon-evolutions.ts (only
// imported by the build script) and are fetched on demand from
// /data/incarnon-evolutions.json — see apps/web/src/lib/incarnon-query.ts.

export type {
  IncarnonEvolution,
  IncarnonPerk,
  IncarnonTier,
} from "./incarnon-evolutions"

/** Stable identifier for the incarnon-form alt-fire attack mode in the item data. */
export const INCARNON_FORM_ATTACK_NAME = "Incarnon Form"

/** All 53 incarnon-eligible base weapon names (8 innate + 45 Steel Path). */
export const INCARNON_NAMES: ReadonlySet<string> = new Set([
  "Ack & Brunt",
  "Angstrum",
  "Anku",
  "Atomos",
  "Ballistica",
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
  "Destreza",
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
  "Obex",
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
  "Stug",
  "Sybaris",
  "Thalys",
  "Torid",
  "Vasto",
  "Vectis",
  "Zylok",
])

/**
 * Genesis adapter icon filenames keyed by base weapon name (Steel Path Circuit
 * weapons only — innate incarnons aren't included). The build matches each
 * filename against the DE manifest to emit `incarnon-adapter-images.json`
 * (base name → resolved CDN URL), which the editor fetches; see
 * scripts/build-items-index.ts.
 */
export const INCARNON_GENESIS_IMAGES: Readonly<Record<string, string>> = {
  "Ack & Brunt": "AckBruntIncarnonAdapter.png",
  Angstrum: "AngstrumIncarnonAdapter.png",
  Anku: "AnkuIncarnonAdapter.png",
  Atomos: "AtomosIncarnonAdapter.png",
  Ballistica: "BallisticaIncarnonAdapter.png",
  Bo: "BoIncarnonAdapter.png",
  Boar: "BoarIncarnonAdapter.png",
  Boltor: "BoltorIncarnonAdapter.png",
  Braton: "BratonIncarnonAdapter.png",
  Bronco: "BroncoIncarnonAdapter.png",
  Burston: "BurstonIncarnonAdapter.png",
  "Ceramic Dagger": "CeramicDaggerIncarnonAdapter.png",
  Cestra: "CestraIncarnonAdapter.png",
  Dera: "DeraIncarnonAdapter.png",
  Despair: "DespairIncarnonAdapter.png",
  Destreza: "DestrezaIncarnonAdapter.png",
  Dread: "DreadIncarnonAdapter.png",
  "Dual Ichor": "DualIchorIncarnonAdapter.png",
  "Dual Toxocyst": "DualToxocystIncarnonAdapter.png",
  Furax: "FuraxIncarnonAdapter.png",
  Furis: "FurisIncarnonAdapter.png",
  Gammacor: "GammacorIncarnonAdapter.png",
  Gorgon: "GorgonIncarnonAdapter.png",
  Hate: "HateIncarnonAdapter.png",
  Kunai: "KunaiIncarnonAdapter.png",
  Lato: "LatoIncarnonAdapter.png",
  Latron: "LatronIncarnonAdapter.png",
  Lex: "LexIncarnonAdapter.png",
  Magistar: "MagistarIncarnonAdapter.png",
  Miter: "MiterIncarnonAdapter.png",
  "Nami Solo": "NamiIncarnonAdapter.png",
  Obex: "ObexIncarnonAdapter.png",
  Okina: "OkinaIncarnonAdapter.png",
  Paris: "ParisIncarnonAdapter.png",
  Sibear: "SibearIncarnonAdapter.png",
  Sicarus: "SicarusIncarnonAdapter.png",
  Skana: "SkanaIncarnonAdapter.png",
  Soma: "SomaIncarnonAdapter.png",
  Strun: "StrunIncarnonAdapter.png",
  Stug: "StugIncarnonAdapter.png",
  Sybaris: "SybarisIncarnonAdapter.png",
  Torid: "ToridIncarnonAdapter.png",
  Vasto: "VastoIncarnonAdapter.png",
  Vectis: "VectisIncarnonAdapter.png",
  Zylok: "ZylokPrimeIncarnonAdapter.png",
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

/** Resolves a weapon name (incl. variants) to its base incarnon key, or null. */
export function getIncarnonBaseName(weaponName: string): string | null {
  if (INCARNON_NAMES.has(weaponName)) return weaponName
  const stripped = stripVariant(weaponName)
  return INCARNON_NAMES.has(stripped) ? stripped : null
}

export function hasIncarnon(weaponName: string): boolean {
  return getIncarnonBaseName(weaponName) !== null
}

/** True for innate incarnons (Felarx, Phenmor, Laetum, …) — no separate adapter. */
export function isInnateIncarnon(weaponName: string): boolean {
  const base = getIncarnonBaseName(weaponName)
  return base !== null && !INCARNON_GENESIS_IMAGES[base]
}
