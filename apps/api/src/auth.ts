import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { username } from "better-auth/plugins"

import { prisma } from "./db"
import { webOrigins } from "./env"
import { validateExternalUrl } from "./lib/validate"

// Normalise user.image to a value validateExternalUrl accepts, or null. The
// hook fires for OAuth sign-in (`create`), provider-driven refreshes and
// admin-tool round-trips (`update`), AND the user-facing /update-user
// endpoint — we can't tell them apart inside Better Auth's hook contract.
// Throwing on rejection would lock users out of sign-in if a provider ever
// returns an avatar URL the validator dislikes, so we always silently null
// instead. Hard validation for human input lives in the route handlers
// where we control the response shape (see orgs.ts `invalid_image_url`).
function sanitizeUserImage(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (!("image" in data)) return data
  const v = data.image
  if (v == null || v === "") return { ...data, image: null }
  if (typeof v === "string") {
    const validated = validateExternalUrl(v)
    if (validated) return { ...data, image: validated }
  }
  return { ...data, image: null }
}

const githubId = process.env.GITHUB_CLIENT_ID?.trim()
const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim()
if (!githubId || !githubSecret) {
  console.info(
    "auth: GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET missing — GitHub OAuth is disabled.",
  )
}

// Drive cookie flags off BETTER_AUTH_URL's scheme, not NODE_ENV. If NODE_ENV
// were ever missing/unset in prod, the old check silently dropped Secure +
// SameSite=None and cross-origin login broke. The scheme is always correct.
const isHttps = process.env.BETTER_AUTH_URL?.startsWith("https://") === true

// Email+password sign-in exists only for local dev — we have no email service
// for verification/reset flows, so prod stays GitHub-OAuth-only.
const devEmailPasswordEnabled = process.env.NODE_ENV === "development"

export const auth = betterAuth({
  appName: "Arsenyx",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8787",
  basePath: "/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: webOrigins,
  emailAndPassword: { enabled: devEmailPasswordEnabled },
  socialProviders:
    githubId && githubSecret
      ? {
          github: {
            clientId: githubId,
            clientSecret: githubSecret,
            // Refresh the user record (notably `image`) from GitHub on every
            // sign-in. Without this, a user whose avatar got nulled by the
            // image-validation backfill — or whose profile changed on GitHub
            // — keeps the stale stored value forever, since Better Auth
            // otherwise only writes profile fields on first sign-in.
            overrideUserInfoOnSignIn: true,
            mapProfileToUser: (profile) => ({
              username: profile.login.toLowerCase(),
              displayUsername: profile.login,
            }),
          },
        }
      : {},
  plugins: [username()],
  databaseHooks: {
    user: {
      create: { before: async (data) => ({ data: sanitizeUserImage(data) }) },
      update: { before: async (data) => ({ data: sanitizeUserImage(data) }) },
    },
  },
  user: {
    deleteUser: { enabled: true },
    additionalFields: {
      isVerified: { type: "boolean", defaultValue: false },
      isCommunityLeader: { type: "boolean", defaultValue: false },
      isModerator: { type: "boolean", defaultValue: false },
      isAdmin: { type: "boolean", defaultValue: false },
      isBanned: { type: "boolean", defaultValue: false },
      defaultBuildVisibility: { type: "string", defaultValue: "PUBLIC" },
    },
  },
  session: {
    // 60s keeps admin-revocation / ban latency tolerable without hammering
    // the DB on every request. Raise cautiously — privileged flags on the
    // session are read straight from this cache.
    cookieCache: { enabled: true, maxAge: 60 },
  },
  advanced: {
    // Host-only cookies on api.arsenyx.com — web clients call /auth/get-session
    // cross-origin with credentials:include; no need for Domain=.arsenyx.com.
    crossSubDomainCookies: { enabled: false },
    defaultCookieAttributes: {
      sameSite: isHttps ? "none" : "lax",
      secure: isHttps,
    },
  },
})
