/**
 * Seed a local dev database with generated sample data: users, an org, and
 * builds of real catalog items (apps/web/public/data) carrying real mods, plus
 * guides, likes, bookmarks, views and a CREATED revision each.
 *
 * Invoked by scripts/setup.ts. Skips when any build already exists, so re-running
 * setup never duplicates; `just db-reset` starts over. Deterministic (fixed
 * seed), so every reset yields the same slugs. Localhost only.
 *
 * Mods go only on the item types whose generic mod family is unambiguous
 * (Warframe, Rifle, Shotgun, Pistol, Melee) and skip augments, exilus, conclave
 * and variant families (Primed, Umbral…) so no build stacks conflicting mods.
 * Slot JSON matches what the editor saves (`stripPersistedImages` shape: mods
 * inline, no imageName). formaCalcVersion stays 0 ("never computed").
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { Client } from "pg"

const dbUrl = process.env.DATABASE_URL ?? ""
if (new URL(dbUrl).hostname !== "localhost") {
  console.error("seed-sample only runs against a localhost DATABASE_URL.")
  process.exit(1)
}

const DATA = resolve(import.meta.dirname, "../../web/public/data")
const json = (f: string) => JSON.parse(readFileSync(resolve(DATA, f), "utf8"))

type Item = { uniqueName: string; name: string; category: string; imageName?: string; displayClass?: string }
type Mod = Record<string, unknown> & {
  uniqueName: string
  name: string
  compatName?: string
  fusionLimit: number
  isAugment?: boolean
  isExilus?: boolean
  isConclave?: boolean
}

// mulberry32: tiny seeded PRNG so resets are reproducible.
let seed = 0x5eed
function rand(): number {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (n: number) => Math.floor(rand() * n)
const pick = <T>(xs: T[]): T => xs[int(xs.length)]!
const sample = <T>(xs: T[], n: number): T[] =>
  [...xs].sort(() => rand() - 0.5).slice(0, n)
const slug = () =>
  Array.from({ length: 10 }, () => pick([..."23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"])).join("")
const id = () => `seed${slug()}`

const VARIANT_FAMILY = /^(Primed|Flawed|Umbral|Galvanized|Amalgam|Archon|Spectral|Sacrificial|Vigilante|Augur|Gladiator)\b/
const mods: Mod[] = (json("mods-all.json") as Mod[]).filter(
  (m) => !m.isAugment && !m.isExilus && !m.isConclave && !VARIANT_FAMILY.test(m.name),
)
const modsFor = (compat: string) => mods.filter((m) => m.compatName === compat)

const index = json("items-index.json") as Record<string, Item[]>
// [category, displayClass filter, mod compatName, aura?]
const KINDS: [string, (i: Item) => boolean, string, boolean][] = [
  ["warframes", () => true, "WARFRAME", true],
  ["primary", (i) => i.displayClass === "Rifle", "Rifle", false],
  ["primary", (i) => i.displayClass === "Shotgun", "Shotgun", false],
  ["secondary", (i) => i.displayClass === "Pistol", "Pistol", false],
  ["melee", (i) => !/Zaw|Unique/.test(i.displayClass ?? ""), "Melee", false],
]

function buildData(compat: string, aura: boolean) {
  const slots: Record<string, unknown> = {}
  const placed = (m: Mod) => {
    const { imageName: _drop, ...mod } = m
    return { mod, rank: m.fusionLimit }
  }
  sample(modsFor(compat), 8).forEach((m, i) => (slots[`normal-${i}`] = placed(m)))
  if (aura) slots["aura-0"] = placed(pick(modsFor("AURA")))
  return {
    version: 1,
    slots,
    formaPolarities: {},
    arcanes: [],
    shards: [],
    hasReactor: true,
    helminth: {},
  }
}

const NAMES = ["Tennoroll", "voidwalker", "GrineerHunter", "lotus_fan", "KuvaKid", "SteelPathSam", "eidolon_eve", "CorpusCarl", "Ordis42", "Tenno_Tess", "duviri_dan", "Nightwave"]
const BUILD_NAMES = ["General Use", "Steel Path", "Budget", "Crit Focus", "Status Spread", "Eidolon", "Endurance", "Speedrun", "Starter", "No Forma"]
const GUIDE = `## Overview\n\nA well-rounded setup for most content.\n\n## Mods\n\n- Core damage first\n- Flex slots for **utility**\n\n## Playstyle\n\nKeep moving, prioritise priority targets.`

async function main() {
  const url = new URL(dbUrl)
  const client = new Client({ connectionString: url.toString(), ssl: false })
  await client.connect()
  const q = (text: string, values: unknown[] = []) => client.query(text, values)
  try {
    const { rows } = await q("SELECT 1 FROM builds LIMIT 1")
    if (rows.length) return console.log("✓ sample data skipped (builds already exist)")

    await q("BEGIN")
    const now = Date.now()
    const ago = (maxDays: number) => new Date(now - rand() * maxDays * 86_400_000)

    const users: string[] = []
    for (const name of NAMES) {
      const uid = id()
      users.push(uid)
      await q(
        `INSERT INTO users (id, name, email, "emailVerified", username, "displayUsername", "isVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, $2, $5, $6, $6)`,
        [uid, name, `${name.toLowerCase()}@sample.local`, name.toLowerCase(), rand() < 0.3, ago(365)],
      )
    }

    const orgId = id()
    await q(
      `INSERT INTO organizations (id, name, slug, description, verified, "updatedAt") VALUES ($1, 'Sample Clan', 'sample-clan', 'Seeded dev org', true, NOW())`,
      [orgId],
    )
    const orgMembers = users.slice(0, 3)
    for (const [i, uid] of orgMembers.entries()) {
      await q(`INSERT INTO organization_members ("organizationId", "userId", role) VALUES ($1, $2, $3)`, [orgId, uid, i === 0 ? "ADMIN" : "MEMBER"])
    }

    let builds = 0
    for (const [category, filter, compat, aura] of KINDS) {
      for (const item of sample(index[category]!.filter(filter), 14)) {
        const bid = id()
        const owner = pick(users)
        const inOrg = orgMembers.includes(owner) && rand() < 0.4
        const visibility = rand() < 0.85 ? "PUBLIC" : pick(["PRIVATE", "UNLISTED"])
        const hasGuide = rand() < 0.35
        const createdAt = ago(120)
        await q(
          `INSERT INTO builds (id, slug, "userId", "organizationId", "itemUniqueName", "itemCategory", "itemName", "itemImageName",
             name, visibility, "buildData", "hasGuide", "viewCount", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
          [bid, slug(), owner, inOrg ? orgId : null, item.uniqueName, category, item.name, item.imageName ?? null,
            `${item.name} ${pick(BUILD_NAMES)}`, visibility, JSON.stringify(buildData(compat, aura)), hasGuide, int(5000), createdAt],
        )
        if (hasGuide) {
          await q(`INSERT INTO build_guides (id, "buildId", summary, description, "updatedAt") VALUES ($1, $2, $3, $4, NOW())`,
            [id(), bid, `How I run ${item.name}.`, GUIDE])
        }
        await q(`INSERT INTO build_revisions (id, "buildId", "editorId", kind, "createdAt") VALUES ($1, $2, $3, 'CREATED', $4)`,
          [id(), bid, owner, createdAt])
        for (const uid of sample(users, int(users.length))) {
          await q(`INSERT INTO build_likes (id, "userId", "buildId", value) VALUES ($1, $2, $3, $4)`, [id(), uid, bid, rand() < 0.85 ? 1 : -1])
          if (rand() < 0.3) await q(`INSERT INTO build_bookmarks (id, "userId", "buildId") VALUES ($1, $2, $3)`, [id(), uid, bid])
        }
        builds++
      }
    }

    // Denormalized counters, derived from the rows above.
    await q(`UPDATE builds b SET
      "likeCount" = (SELECT count(*) FROM build_likes l WHERE l."buildId" = b.id AND l.value = 1),
      "dislikeCount" = (SELECT count(*) FROM build_likes l WHERE l."buildId" = b.id AND l.value = -1),
      "bookmarkCount" = (SELECT count(*) FROM build_bookmarks k WHERE k."buildId" = b.id)`)
    await q("COMMIT")
    console.log(`✓ sample data: ${users.length} users, 1 org, ${builds} builds`)
  } catch (err) {
    await q("ROLLBACK").catch(() => {})
    throw err
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error("seed-sample failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
