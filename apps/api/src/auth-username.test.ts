import { beforeEach, describe, expect, it, vi } from "vitest"

// Regression cover for issue #339: every returning GitHub user was locked out
// with USERNAME_IS_ALREADY_TAKEN, colliding with their own row.
//
// The mechanism lives upstream. better-auth >= 1.6.x validates username
// uniqueness inside the username plugin's user.update database hook for every
// path except /sign-up/email and /update-user, and on the OAuth callback it
// cannot resolve the current user id (no session yet, and link-account strips
// `id` out of the update payload). `overrideUserInfoOnSignIn: true` replays
// whatever mapProfileToUser returns into exactly that update.
//
// So there are two things to pin: that the upstream hook still behaves the way
// the fix assumes, and that mapProfileToUser keeps `username` out of the
// update for anyone who already has one.

// A two-table stand-in for Postgres: GitHub-linked accounts keyed by account
// id, users keyed by email. The lookups answer from these, so the tests pin
// which row a profile resolves to — not the shape of the Prisma call.
const linkedAccounts = new Map<string, { username: string | null }>()
const usersByEmail = new Map<string, { username: string | null }>()
const emailLookups: string[] = []

vi.mock("./db", () => ({
  prisma: {
    account: {
      findUnique: async ({
        where,
      }: {
        where: {
          providerId_accountId: { providerId: string; accountId: string }
        }
      }) => {
        const { providerId, accountId } = where.providerId_accountId
        const user =
          providerId === "github" ? linkedAccounts.get(accountId) : undefined
        return user ? { user } : null
      },
    },
    user: {
      findUnique: async ({ where }: { where: { email: string } }) => {
        emailLookups.push(where.email)
        return usersByEmail.get(where.email) ?? null
      },
    },
  },
}))

process.env.GITHUB_CLIENT_ID = "test-client-id"
process.env.GITHUB_CLIENT_SECRET = "test-client-secret"
process.env.BETTER_AUTH_SECRET = "test-secret-not-used-for-anything-real"

const { auth, USERNAME_PLUGIN_OPTIONS } = await import("./auth")

type GithubProfile = { id: number; login: string; email: string | null }

const mapProfileToUser = (
  auth.options.socialProviders as unknown as {
    github: {
      mapProfileToUser: (
        p: GithubProfile,
      ) => Promise<{ username?: string; displayUsername?: string }>
    }
  }
).github.mapProfileToUser

const PROFILE: GithubProfile = {
  id: 4242,
  login: "Shinkokuna",
  email: "Shinkokuna@example.com",
}

const ASSIGNED = {
  username: "shinkokuna",
  displayUsername: "Shinkokuna",
}

beforeEach(() => {
  linkedAccounts.clear()
  usersByEmail.clear()
  emailLookups.length = 0
})

describe("github mapProfileToUser", () => {
  it("omits username for a returning user who already has one", async () => {
    linkedAccounts.set("4242", { username: "shinkokuna" })

    // Nothing to replay into the update — this is what keeps the upstream
    // uniqueness hook from firing against the user's own row.
    expect(await mapProfileToUser(PROFILE)).toEqual({})
  })

  it("resolves the account linked to this GitHub id, not another's", async () => {
    // Someone else's linked account holds a username; this profile's doesn't
    // exist yet, so it's a first sign-in.
    linkedAccounts.set("9999", { username: "someone-else" })
    expect(await mapProfileToUser({ ...PROFILE, email: null })).toEqual(
      ASSIGNED,
    )
  })

  it("prefers the linked account over the email match", async () => {
    // The two can resolve to different rows once someone repoints their
    // GitHub primary email at an address another Arsenyx row already owns.
    // The linked account is the signing-in user; the email row is a stranger.
    linkedAccounts.set("4242", { username: "shinkokuna" })
    usersByEmail.set("shinkokuna@example.com", { username: null })

    expect(await mapProfileToUser(PROFILE)).toEqual({})
  })

  it("falls back to email (case-folded) when no account is linked yet", async () => {
    usersByEmail.set("shinkokuna@example.com", { username: "someone" })

    expect(await mapProfileToUser(PROFILE)).toEqual({})
  })

  it("skips the email lookup when GitHub hides the address", async () => {
    expect(await mapProfileToUser({ ...PROFILE, email: null })).toEqual(
      ASSIGNED,
    )
    expect(emailLookups).toEqual([])
  })

  it("assigns a username on first sign-in", async () => {
    expect(await mapProfileToUser(PROFILE)).toEqual(ASSIGNED)
  })

  it("backfills a row that predates the username plugin", async () => {
    linkedAccounts.set("4242", { username: null })

    expect(await mapProfileToUser(PROFILE)).toEqual(ASSIGNED)
  })

  it("suffixes a reserved login, idempotently across sign-ins", async () => {
    const reserved = { id: 7, login: "support", email: "s@example.com" }

    const first = await mapProfileToUser(reserved)
    // Second sign-in: the row now exists and carries the suffixed name, so
    // nothing is replayed into the update.
    linkedAccounts.set("7", { username: "support-gh7" })
    const second = await mapProfileToUser(reserved)

    expect(first).toEqual({
      username: "support-gh7",
      displayUsername: "support-gh7",
    })
    expect(second).toEqual({})
  })

  // Issue #374: GitHub logins may contain hyphens, and the username plugin's
  // user.create hook runs our validator on the OAuth callback, so a login like
  // `Len-Github` was rejected with USERNAME_IS_INVALID before any row existed.
  it("keeps a hyphenated login as-is", async () => {
    const hyphen = { id: 99, login: "Len-Github", email: null }
    expect(await mapProfileToUser(hyphen)).toEqual({
      username: "len-github",
      displayUsername: "Len-Github",
    })
  })

  it("pads a login shorter than the minimum with the GitHub id", async () => {
    const short = { id: 12, login: "ab", email: null }
    expect(await mapProfileToUser(short)).toEqual({
      username: "ab-gh12",
      displayUsername: "ab-gh12",
    })
  })

  it("truncates a login longer than the maximum, keeping it unique", async () => {
    // 39 chars — GitHub's own ceiling.
    const long = { id: 5, login: "a".repeat(39), email: null }
    const out = await mapProfileToUser(long)
    expect(out.username).toBe(`${"a".repeat(26)}-gh5`)
    expect(out.displayUsername).toBe(out.username)
  })
})

describe("derived usernames survive the plugin's user.create hook", () => {
  // Every login GitHub can hand us must pass better-auth's create hook with
  // OUR options installed — that's the exact spot #374 died.
  async function createBefore(username: string) {
    const { username: plugin } = await import("better-auth/plugins")
    const hook = (
      plugin(USERNAME_PLUGIN_OPTIONS).init({
        adapter: { findOne: async () => null },
      } as never) as unknown as {
        options: {
          databaseHooks: {
            user: {
              create: {
                before: (
                  data: Record<string, unknown>,
                  ctx: unknown,
                ) => Promise<unknown>
              }
            }
          }
        }
      }
    ).options.databaseHooks.user.create.before
    return hook({ username }, { path: "/callback/:id", context: {} })
  }

  it.each(["Len-Github", "ab", "a".repeat(39), "support", "Shinkokuna"])(
    "accepts the username derived from %s",
    async (login) => {
      const { username } = (await mapProfileToUser({
        id: 1,
        login,
        email: null,
      })) as { username: string }
      await expect(createBefore(username)).resolves.toMatchObject({
        data: { username },
      })
    },
  )

  it("still rejects characters GitHub can't produce", async () => {
    await expect(createBefore("bad name")).rejects.toMatchObject({
      body: { code: "INVALID_USERNAME" },
    })
  })
})

describe("upstream username plugin (the behaviour the fix works around)", () => {
  // If this test ever fails, better-auth changed the hook and the workaround
  // in mapProfileToUser can probably be simplified — read #339 first.
  it("rejects an OAuth-callback update that carries a username", async () => {
    const { username } = await import("better-auth/plugins")

    const ownRow = { id: "user_abc", username: "shinkokuna" }
    const adapter = {
      findOne: async ({
        where,
      }: {
        where: { field: string; value: unknown }[]
      }) =>
        where.find((w) => w.field === "username")?.value === ownRow.username
          ? ownRow
          : null,
    }

    const updateBefore = (
      username().init({ adapter } as never) as {
        options: {
          databaseHooks: {
            user: {
              update: {
                before: (
                  data: Record<string, unknown>,
                  ctx: unknown,
                ) => Promise<unknown>
              }
            }
          }
        }
      }
    ).options.databaseHooks.user.update.before

    // The callback shape: no session, and no `id` in the payload.
    const callbackCtx = { path: "/callback/:id", context: {} }

    await expect(
      updateBefore({ username: ownRow.username }, callbackCtx),
    ).rejects.toMatchObject({ body: { code: "USERNAME_IS_ALREADY_TAKEN" } })

    // Same payload with no username is waved through — that's the escape
    // hatch mapProfileToUser uses.
    await expect(
      updateBefore({ name: "Shinkokuna" }, callbackCtx),
    ).resolves.toBeTruthy()
  })
})

// Issue #466: /update-user always hands the hook `name` and `image` keys, set
// to undefined when the client didn't send them. A display-name-only save must
// leave the stored avatar alone, not null it.
describe("user.update hook", () => {
  const before = (
    auth.options.databaseHooks as unknown as {
      user: {
        update: {
          before: (
            d: Record<string, unknown>,
          ) => Promise<{ data: Record<string, unknown> }>
        }
      }
    }
  ).user.update.before

  it("keeps an undefined image undefined", async () => {
    const { data } = await before({
      name: undefined,
      image: undefined,
      displayUsername: "Renamed",
    })
    expect(data.image).toBeUndefined()
  })

  it("still clears an explicit empty image", async () => {
    const { data } = await before({ image: "" })
    expect(data.image).toBeNull()
  })
})
