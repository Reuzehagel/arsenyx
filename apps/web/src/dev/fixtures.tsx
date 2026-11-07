// DEV-ONLY stress fixtures. `?data=worst|empty|one|many`
// swaps a list or profile response at the data boundary. Every export is
// picked on import.meta.env.DEV at definition and all data is built lazily,
// so a prod build gets pass-throughs and tree-shakes the fixtures away.
import type {
  BuildListItemResponse,
  BuildListResponse,
} from "@arsenyx/shared/api/build-dto"
import type {
  OrgDirectoryItem,
  OrgDirectoryResponse,
} from "@arsenyx/shared/api/orgs"
import type {
  Profile,
  ProfileDirectoryItem,
  ProfileDirectoryResponse,
} from "@arsenyx/shared/api/users"
import { useSyncExternalStore } from "react"

const STATES = ["demo", "worst", "empty", "one", "many"] as const
type DataState = (typeof STATES)[number]
const LABELS: Record<DataState, string> = {
  demo: "Demo data",
  worst: "Worst case",
  empty: "Empty",
  one: "One",
  many: "Many",
}

// Also the marker `check:dev-leak` looks for in the prod bundle: every export
// path reads it, so any fixture code that ships carries it.
const EVENT = "arsenyx-dev-only"
function readDataState(): DataState {
  const v = new URLSearchParams(location.search).get("data")
  return (STATES as readonly string[]).includes(v ?? "")
    ? (v as DataState)
    : "demo"
}
function subscribeDataState(cb: () => void) {
  addEventListener(EVENT, cb)
  addEventListener("popstate", cb)
  return () => {
    removeEventListener(EVENT, cb)
    removeEventListener("popstate", cb)
  }
}
function setDataState(state: DataState) {
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

export const worstBuilds = (): BuildListItemResponse[] => [
  // BUILD_NAME_MAX long (fixtures.test.ts pins every limit-length string).
  build(1, {
    name: "Wisp Prime — Steel Path Survival / Mirror Defense / Netracells (no Helminth, budget, works without Archon Shards!!) v3.1",
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
  // Two-letter author, build named after its item, no forma, zero everything.
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
  // RTL org name + CJK build name, author hidden.
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
  // USERNAME_MAX-long username, no display name.
  build(7, {
    name: "Konstantin Oberhauser-Wettstein",
    item: ITEMS.bramma,
    user: user(null, "konstantin.oberhauser-wettstei"),
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
      return page(worstBuilds())
    case "empty":
      return page([])
    case "one":
      return page([worstBuilds()[2]!])
    case "many":
      return page(many(), 1284)
    default:
      return null
  }
}

/** `real`, or the fixture for the `?data=` state when one is given (dev only).
 *  Swap at the data boundary: right where the query result is read. */
function useFixture<T>(
  real: T,
  fixtures: Partial<Record<DataState, () => T>>,
): T {
  const state = useSyncExternalStore(
    subscribeDataState,
    readDataState,
    () => "demo" as const,
  )
  return fixtures[state]?.() ?? real
}

const passThrough = <T,>(real: T) => real

function useBuildListFixtureDev<T extends BuildListResponse | undefined>(
  real: T,
): T | BuildListResponse {
  return useFixture<T | BuildListResponse>(real, {
    worst: () => fixture("worst")!,
    empty: () => fixture("empty")!,
    one: () => fixture("one")!,
    many: () => fixture("many")!,
  })
}

// --- Profiles / orgs ---------------------------------------------------------

const NO_BADGES = {
  verified: false,
  communityLeader: false,
  moderator: false,
  admin: false,
}
const DEAD_AVATAR = "https://img.arsenyx.com/missing-avatar-00000000.webp"
const BIO_URL =
  "Endo farming & Steel Path guides: https://example.com/arsenyx/guides/steel-path/endurance/survival-netracells?ref=profile-bio-link"

function profileItem(
  i: number,
  over: Partial<ProfileDirectoryItem>,
): ProfileDirectoryItem {
  return {
    id: `p${i}`,
    name: null,
    username: `tenno${i}`,
    displayUsername: `tenno${i}`,
    image: null,
    bio: null,
    joinedAt: ago(200 * DAY),
    badges: NO_BADGES,
    buildCount: 3,
    ...over,
  }
}

export const worstProfiles = (): ProfileDirectoryItem[] => [
  profileItem(1, {
    displayUsername: "Aleksandra Wiśniewska-Kowalczyk-Nowakowska-Zielińs", // 50 = DISPLAY_USERNAME_MAX
    username: "aleksandra.wisniewska-kowalczy", // 30 = USERNAME_MAX
    bio: BIO_URL,
    badges: { ...NO_BADGES, admin: true, moderator: true, verified: true },
    buildCount: 1284,
  }),
  profileItem(2, {
    displayUsername: "👩🏽‍💻 Priya",
    username: "priya",
    image: DEAD_AVATAR,
    buildCount: 1,
    joinedAt: ago(0),
  }),
  profileItem(3, {
    displayUsername: "Jo",
    username: "jo-",
    bio: "Đặng Thị Ngọc Hân — Wisp main. ".repeat(12),
    buildCount: 0,
  }),
  profileItem(4, {
    displayUsername: "نور الهدى عبد الرحمن",
    username: "nour",
    badges: { ...NO_BADGES, communityLeader: true },
  }),
  profileItem(5, {
    displayUsername: null,
    username: "dana",
    buildCount: 99_999,
  }),
  profileItem(6, {
    displayUsername: "SP_Eidolon_Hunter_Christopher_Montgomery_the_Third",
    username: "chris",
  }),
]

function orgItem(i: number, over: Partial<OrgDirectoryItem>): OrgDirectoryItem {
  return {
    id: `o${i}`,
    name: "Tenno Union",
    slug: `org-${i}`,
    image: null,
    description: null,
    verified: false,
    createdAt: ago(100 * DAY),
    memberCount: 4,
    buildCount: 12,
    ...over,
  }
}

export const worstOrgs = (): OrgDirectoryItem[] => [
  orgItem(1, {
    name: "Steel Path Endurance Collective!", // 32 = ORG_NAME_MAX
    slug: "steel-path-endurance-collectiv", // 30 = ORG_SLUG_MAX
    description:
      "We run 4h+ Steel Path survivals, Netracells and Archon hunts every weekend. Builds here are tested in real runs. Ask in our Discord before copying.", // ~150 of 200
    verified: true,
    memberCount: 1284,
    buildCount: 1,
  }),
  orgItem(2, {
    name: "王秀英公会",
    image: DEAD_AVATAR,
    memberCount: 1,
    buildCount: 0,
    description:
      "https://example.com/discord/invite/aVeryLongInviteCodeThatDoesNotBreak1234567890",
  }),
  orgItem(3, { name: "🦊 Fox Den", memberCount: 0 }),
  orgItem(4, { name: "J", slug: "j-j" }),
]

const envelope = { page: 1, limit: 24 }

function useProfilesFixtureDev(real: ProfileDirectoryResponse) {
  return useFixture(real, {
    worst: () => ({ ...envelope, users: worstProfiles(), total: 6 }),
    empty: () => ({ ...envelope, users: [], total: 0 }),
    one: () => ({ ...envelope, users: [worstProfiles()[1]!], total: 1 }),
  })
}

function useOrgsFixtureDev(real: OrgDirectoryResponse) {
  return useFixture(real, {
    worst: () => ({ ...envelope, orgs: worstOrgs(), total: 4 }),
    empty: () => ({ ...envelope, orgs: [], total: 0 }),
    one: () => ({ ...envelope, orgs: [worstOrgs()[1]!], total: 1 }),
  })
}

function useProfileFixtureDev(real: Profile) {
  return useFixture(real, {
    worst: () => ({
      ...real,
      ...worstProfiles()[0]!,
      image: DEAD_AVATAR,
      displayUsername: "SP_Eidolon_Hunter_Christopher_Montgomery_the_Third",
      badges: {
        verified: true,
        communityLeader: true,
        moderator: true,
        admin: true,
      },
      stats: {
        buildCount: 1284,
        totalLikes: 99_999,
        totalBookmarks: 1,
        totalViews: 12_345_678,
      },
      orgs: worstOrgs().map((o) => ({ ...o, role: "MEMBER" as const })),
    }),
  })
}

function FixtureToggleDev() {
  const state = useSyncExternalStore(
    subscribeDataState,
    readDataState,
    () => "demo" as const,
  )
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
          onClick={() => setDataState(s)}
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

const DEV = import.meta.env.DEV
export const useBuildListFixture: typeof useBuildListFixtureDev = DEV
  ? useBuildListFixtureDev
  : passThrough
export const useProfilesFixture = DEV ? useProfilesFixtureDev : passThrough
export const useOrgsFixture = DEV ? useOrgsFixtureDev : passThrough
export const useProfileFixture = DEV ? useProfileFixtureDev : passThrough
export const FixtureToggle = DEV ? FixtureToggleDev : () => null
