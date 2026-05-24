import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { username } from "better-auth/plugins"

import { prisma } from "./db"
import { webOrigins } from "./env"
import { validateExternalUrl } from "./lib/validate"

// Mirror of the BuildVisibility enum in prisma/schema.prisma. Inlined to
// avoid pulling generated Prisma types into the auth bootstrap path.
const VALID_BUILD_VISIBILITIES = new Set(["PUBLIC", "PRIVATE", "UNLISTED"])

// Usernames we won't let a regular user claim — `admin/support/security/...`
// in `/profile/<name>` reads as official Arsenyx staff, which is a phishing
// surface even though none of these flags actually grant privileges
// (isAdmin is a separate column gated on the server side). Same list feeds
// the `usernameValidator` below; the hook also catches the OAuth path.
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "arsenyx",
  "auth",
  "billing",
  "help",
  "info",
  "mod",
  "moderator",
  "noreply",
  "no-reply",
  "official",
  "owner",
  "root",
  "security",
  "staff",
  "support",
  "system",
  "team",
])

function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(value.toLowerCase())
}

// Sanitiser for user create/update payloads. Fires for OAuth sign-in
// (`create`), provider-driven refreshes and admin-tool round-trips
// (`update`), AND the user-facing /update-user endpoint — Better Auth's
// hook contract doesn't tell them apart, so we rewrite invalid values to
// safe defaults rather than throw (a throw would lock users out of sign-in
// if a provider ever returns something we don't like).
//
// Hard validation for human input lives in the route handlers where we
// control the response shape (see orgs.ts `invalid_image_url`, and the
// `usernameValidator` on the plugin below which throws on /update-user).
function sanitizeUserData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  let out = data

  if ("image" in out) {
    const v = out.image
    if (v == null || v === "") {
      out = { ...out, image: null }
    } else if (typeof v === "string") {
      const validated = validateExternalUrl(v)
      out = { ...out, image: validated ?? null }
    } else {
      out = { ...out, image: null }
    }
  }

  // The field is exposed via additionalFields (so it surfaces on
  // session.user) but Better Auth has no per-field validator there. Without
  // this, /auth/update-user accepts any string and the write fails at the
  // Postgres enum cast — a 500 with no useful client signal, plus the
  // cookie-cached session can briefly hold the bogus value.
  if ("defaultBuildVisibility" in out) {
    const v = out.defaultBuildVisibility
    if (typeof v !== "string" || !VALID_BUILD_VISIBILITIES.has(v)) {
      // Strip rather than overwrite — leaves any existing DB value intact
      // on update, defaults to "PUBLIC" on create (Prisma default).
      const { defaultBuildVisibility: _drop, ...rest } = out
      out = rest
    }
  }

  // Strip reserved usernames from non-OAuth update paths. OAuth sign-in is
  // handled in `mapProfileToUser` (suffix), and `/update-user` is bounced
  // by `usernameValidator` (throws before we get here). This is the
  // belt-and-braces case where neither path applies — e.g. a future
  // provider's profile mapper that forgets to filter.
  if ("username" in out) {
    const v = out.username
    if (typeof v === "string" && isReservedUsername(v)) {
      const { username: _u, displayUsername: _du, ...rest } = out
      out = rest
    }
  }

  // displayUsername is what /profile/<slug> actually renders. better-auth's
  // usernameValidator only fires on `username`, so a /update-user request
  // that touches displayUsername alone bypasses the check. Block reserved
  // values here independently.
  if ("displayUsername" in out) {
    const v = out.displayUsername
    if (typeof v === "string" && isReservedUsername(v)) {
      const { displayUsername: _du, ...rest } = out
      out = rest
    }
  }

  return out
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
            mapProfileToUser: (profile) => {
              const login = profile.login
              // GitHub usernames are unique globally, so the only way a
              // reserved Arsenyx handle lands here is genuine coincidence.
              // Suffix with the (stable) GitHub numeric id so re-sync on
              // every sign-in produces the same value — overrideUserInfo
              // would otherwise churn the username if we generated a
              // fresh suffix each time.
              const reserved = isReservedUsername(login)
              const username = reserved
                ? `${login}-gh${profile.id}`.toLowerCase().slice(0, 30)
                : login.toLowerCase()
              const displayUsername = reserved ? username : login
              return { username, displayUsername }
            },
          },
        }
      : {},
  plugins: [
    username({
      // Default validator is /^[a-zA-Z0-9_.]+$/ (see better-auth source).
      // Layer our reserved-name denylist on top — fires for /sign-up/email,
      // /update-user, /is-username-available, /sign-in/username. OAuth
      // path is covered by mapProfileToUser + sanitizeUserData.
      usernameValidator: (candidate) =>
        /^[a-zA-Z0-9_.]+$/.test(candidate) && !isReservedUsername(candidate),
    }),
  ],
  databaseHooks: {
    user: {
      create: { before: async (data) => ({ data: sanitizeUserData(data) }) },
      update: { before: async (data) => ({ data: sanitizeUserData(data) }) },
    },
  },
  user: {
    deleteUser: { enabled: true },
    additionalFields: {
      // `input: false` is load-bearing — without it, /auth/update-user
      // accepts these fields from the request body and a logged-in user
      // can self-promote to admin / clear their own ban. Privileged flags
      // are mutated only through the admin routes.
      isVerified: { type: "boolean", defaultValue: false, input: false },
      isCommunityLeader: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      isModerator: { type: "boolean", defaultValue: false, input: false },
      isAdmin: { type: "boolean", defaultValue: false, input: false },
      isBanned: { type: "boolean", defaultValue: false, input: false },
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
