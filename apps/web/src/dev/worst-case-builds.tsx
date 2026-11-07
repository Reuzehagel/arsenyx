// DEV-ONLY stress fixture for the build lists (break-ui skill). Swaps the
// `/builds` list response at the data boundary when `?data=` is set; the
// toggle and the swap are both gated on import.meta.env.DEV.
import type {
  BuildListItemResponse,
  BuildListResponse,
} from "@arsenyx/shared/api/build-dto"
import { useSyncExternalStore } from "react"

const STATES = ["demo", "worst", "empty", "one", "many"] as const
type DataState = (typeof STATES)[number]
const LABELS: Record<DataState, string> = {
  demo: "Demo data",
  worst: "Worst case",
  empty: "Empty",
  one: "One",
  many: "1,284 builds",
}

const EVENT = "worst-case-data"
function read(): DataState {
  const v = new URLSearchParams(location.search).get("data")
  return (STATES as readonly string[]).includes(v ?? "")
    ? (v as DataState)
    : "demo"
}
function subscribe(cb: () => void) {
  addEventListener(EVENT, cb)
  addEventListener("popstate", cb)
  return () => {
    removeEventListener(EVENT, cb)
    removeEventListener("popstate", cb)
  }
}
function set(state: DataState) {
  const url = new URL(location.href)
  if (state === "demo") url.searchParams.delete("data")
  else url.searchParams.set("data", state)
  history.replaceState(history.state, "", url)
  dispatchEvent(new Event(EVENT))
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const DAY = 86_400_000

const ITEMS = {
  wisp: {
    uniqueName: "/Lotus/Powersuits/Wisp/WispPrime",
    category: "warframes",
    name: "Wisp Prime",
    imageName: null,
  },
  bramma: {
    uniqueName: "/Lotus/Weapons/Grineer/Bows/GrnBow/GrnBowWeapon",
    category: "primary",
    name: "Kuva Bramma",
    imageName: null,
  },
  gram: {
    uniqueName: "/Lotus/Weapons/Tenno/Melee/Swords/PrimeGram/PrimeGram",
    category: "melee",
    name: "Gram Prime",
    imageName: null,
  },
  acceltra: {
    uniqueName:
      "/Lotus/Weapons/Tenno/LongGuns/PrimeAcceltra/PrimeAcceltraWeapon",
    category: "primary",
    name: "Acceltra Prime",
    imageName: null,
  },
  // Vaulted/removed item: not in image-map, stored image now 404s.
  gone: {
    uniqueName: "/Lotus/Weapons/Removed/OldThing",
    category: "secondary",
    name: "Kuva Nukor",
    imageName: "https://img.arsenyx.com/KuvaNukor-00000000.webp",
  },
} satisfies Record<string, BuildListItemResponse["item"]>

function build(
  i: number,
  over: Partial<BuildListItemResponse>,
): BuildListItemResponse {
  return {
    id: `worst-${i}`,
    slug: `worst-${i}`,
    name: "Steel Path Survival",
    visibility: "PUBLIC",
    likeCount: 3,
    bookmarkCount: 0,
    viewCount: 41,
    formaCount: 2,
    hasGuide: false,
    hasShards: false,
    hideAuthor: false,
    createdAt: ago(2 * DAY),
    updatedAt: ago(2 * DAY),
    item: ITEMS.wisp,
    user: {
      id: `u${i}`,
      name: null,
      username: "tenno",
      displayUsername: "tenno",
      image: null,
    },
    organization: null,
    ...over,
  }
}

const user = (displayUsername: string | null, username: string | null) => ({
  id: displayUsername ?? "anon",
  name: null,
  username,
  displayUsername,
  image: null,
})

const WORST: BuildListItemResponse[] = [
  // 120 chars: the API's MAX_NAME (apps/api/src/routes/builds.ts:86).
  build(1, {
    name: "Wisp Prime — Steel Path Survival / Mirror Defense / Netracells (no Helminth, budget, works without Archon Shards!!) v3",
    likeCount: 1284,
    viewCount: 1_000_000,
    formaCount: 47,
    updatedAt: ago(3 * 365 * DAY),
    user: user("Aleksandra Wiśniewska-Kowalczyk", "aleksandra-wk"),
  }),
  // Unbreakable string, as pasted from a file name.
  build(2, {
    name: "SP_Eidolon_Hunt_Bramma_v12_FINAL_final_with_shards_and_riven_backup",
    item: ITEMS.bramma,
    likeCount: 1,
    viewCount: 1,
    formaCount: 1,
    updatedAt: ago(30_000),
    organization: {
      id: "o1",
      name: "Steel Path Endurance Collective!",
      slug: "spec",
      image: null,
      verified: true,
    },
    user: user("Christopher_Montgomery_the_Third", "chris-montgomery-iii"),
  }),
  // One-letter name, named after the item, no forma, zero everything.
  build(3, {
    name: "Gram Prime",
    item: ITEMS.gram,
    likeCount: 0,
    viewCount: 0,
    formaCount: 0,
    user: user("Jo", "jo-jo"),
  }),
  // Emoji/ZWJ author, Vietnamese diacritics in name.
  build(4, {
    name: "Đặng Thị's Acceltra — Ngọc Hân setup",
    item: ITEMS.acceltra,
    likeCount: 99_999,
    viewCount: 12_345_678,
    formaCount: 8,
    user: user("👩🏽‍💻 Priya", "priya"),
  }),
  // RTL author + CJK build name, org with hidden author.
  build(5, {
    name: "王秀英的毒伤配置",
    item: ITEMS.wisp,
    hideAuthor: true,
    organization: {
      id: "o2",
      name: "نور الهدى عبد الرحمن",
      slug: "rtl",
      image: null,
      verified: false,
    },
    user: user(null, null),
  }),
  // Removed item (image 404), missing author entirely, escaping probe.
  build(6, {
    name: "<b>Nukor</b> &amp; **crit** build",
    item: ITEMS.gone,
    user: user(null, null),
    updatedAt: ago(-5 * 60_000), // client clock behind the server
  }),
  // 30-char username (USERNAME_MAX, apps/api/src/auth.ts:58), no display name.
  build(7, {
    name: "Konstantin Oberhauser-Wettstein",
    item: ITEMS.bramma,
    user: user(null, "konstantin.oberhauser-wettst"),
    likeCount: 12,
    viewCount: 4_096,
  }),
  build(8, { name: "  Steel   Path  ", user: user("dana", "dana") }),
]

function many(): BuildListItemResponse[] {
  const items = Object.values(ITEMS)
  return Array.from({ length: 24 }, (_, i) =>
    build(100 + i, {
      name: `Build ${i + 1}`,
      item: items[i % items.length],
      likeCount: 1284 - i * 37,
      viewCount: 21_000 - i * 400,
    }),
  )
}

function fixture(state: DataState): BuildListResponse | null {
  const page = (builds: BuildListItemResponse[], total = builds.length) => ({
    builds,
    total,
    page: 1,
    limit: 24,
  })
  switch (state) {
    case "worst":
      return page(WORST)
    case "empty":
      return page([])
    case "one":
      return page([WORST[2]!])
    case "many":
      return page(many(), 1284)
    default:
      return null
  }
}

/** The real list response, or the fixture when `?data=` picks one (dev only). */
export function useWorstCaseList<T extends BuildListResponse | undefined>(
  real: T,
): T | BuildListResponse {
  const state = useSyncExternalStore(subscribe, read, () => "demo" as const)
  if (!import.meta.env.DEV) return real
  return fixture(state) ?? real
}

export function WorstCaseToggle() {
  const state = useSyncExternalStore(subscribe, read, () => "demo" as const)
  if (!import.meta.env.DEV) return null
  return (
    <div
      role="radiogroup"
      aria-label="Fixture data"
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "#e5e7eb",
        font: "12px system-ui, sans-serif",
        boxShadow: "0 1px 4px rgb(0 0 0 / 0.2)",
      }}
    >
      {STATES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={state === s}
          onClick={() => set(s)}
          style={{
            border: 0,
            borderRadius: 999,
            padding: "4px 10px",
            cursor: "pointer",
            color: "#111827",
            background: state === s ? "#fff" : "transparent",
          }}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  )
}
